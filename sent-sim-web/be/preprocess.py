from os import stat
from typing import Tuple
import pandas as pd
import numpy as np
import sidekick
import time
import multiprocessing as mp
from threading import Thread
import json


def getRootTweetReplyIDs(df: pd.DataFrame) -> Tuple[pd.DataFrame, np.ndarray]:
    """
    Root messages are the ones that start a conversation. They are identified by the fact that they aren't a reply to any other message
    :param df: dataframe to scan for root messages
    :return: dataframe with only root tweets, list of tweet IDs
    """
    df_filtered = df[df['inbound'] == True]
    df_filtered = df_filtered[pd.isna(df_filtered['in_response_to_tweet_id'])]
    reply_ids = list(map(lambda x: str(x).split(
        ","), df_filtered['response_tweet_id']))
    # Flatten the list of IDs
    reply_ids = [int(reply_id) for t in reply_ids for reply_id in t]
    return df_filtered, reply_ids


def removeStartTwitterHandle(df: pd.DataFrame, columnName: str, replaceWithValue: str = '') -> pd.DataFrame:
    return df[columnName].str.replace(
        '^(@(?:[A-Za-z0-9]+\s))+', replaceWithValue, regex=True)


def getRootMessagesByReplyAuthorID(df: pd.DataFrame, authorID: str) -> pd.DataFrame:
    """
    Get a list of root messages and filter them by author ID of the one replying. For instance, if we want messages
        that Apple Support (author ID: AppleSupport) replied to, we set authorID=AppleSupport

    Parameters
    ----------
    df : pd.DataFrame
        The dataframe to use

    authorID : str
        ID of the author, eg. AppleSupport

    Returns
    -------
    A dataframe
    """
    df_root, tweet_ids = getRootTweetReplyIDs(df)
    idx1 = pd.Index(df['tweet_id'])
    idx2 = pd.Index(tweet_ids)
    found_tweet_ids = idx1.intersection(idx2)
    answers = df[df['tweet_id'].isin(found_tweet_ids)]
    answers = answers[answers['author_id'] == authorID]
    answers["in_response_to_tweet_id"] = answers["in_response_to_tweet_id"].astype(
        np.int32)
    df_res = answers.set_index('in_response_to_tweet_id').join(
        df_root.set_index('tweet_id'), lsuffix='_support', rsuffix='_customer')
    df_res = df_res[['tweet_id', 'author_id_support',
                     'text_customer', 'text_support']]
    df_res["text_support"] = removeStartTwitterHandle(df_res, "text_support")
    # Remove support handle, eg. @AppleSupport, in customer tweets
    df_res["text_customer"] = df_res["text_customer"].str.replace(
        "@"+authorID, '')

    # Remove rows with blank values
    df_res.replace("", np.nan, inplace=True)
    df_res.dropna(inplace=True)

    return df_res


def getDataframeFromCsv(csv_path: str, n_rows: int = None) -> pd.DataFrame:
    return pd.read_csv(csv_path, dtype={'tweet_id': np.int32}, nrows=n_rows)


def chunks(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i:i+n]


def getEmbeddings(texts, url, token, batch_idx, batch_size, callbackFn, callbackArgs):
    """
    ID is kept here so we keep track of which index this us during multiprocessing
    """
    # print('url', url, 'token', token)
    client = sidekick.Deployment(
        url=url, token=token)
    payload = [{'text_customer': txt} for txt in texts]

    res = client.predict_many(payload)
    if callbackFn:
        callbackFn(callbackArgs)

    embeddingSize = len(res[0]["Sentence embedding"])

    resArray = np.zeros(len(res)*embeddingSize,)
    for idx, v in enumerate(res):
        resArray[idx*embeddingSize:(idx+1) *
                 embeddingSize] = v["Sentence embedding"]
    embeddings[batch_idx*batch_size*len(res[0]['Sentence embedding']):(batch_idx*batch_size +
                                                                       len(texts))*len(res[0]['Sentence embedding'])] = resArray


def check_memory_usage(num_texts, max_mem_size_mb, embedding_size):
    # Stop if the memory requirements are too large.
    # 4 bytes required for each float32.
    # There will be a negligible amount of memory allocated for overhead as well
    usage_mb = num_texts*embedding_size*4/(1024*1024)
    print(f"Allocating {usage_mb:.2f} MB memory for embeddings")
    assert usage_mb <= max_mem_size_mb, "Memory limit exceeded"


statusPrintDone = True


def printStatus(ns):
    t_sleep_tot_s = 30
    t_react_s = 1
    while not statusPrintDone:
        t_elapsed = time.time()-ns.t_start
        s_t_left = "-"
        if ns.n_done_batches > 0:
            s_t_left = f'~{(ns.n_tot_batches-ns.n_done_batches)*(t_elapsed/ns.n_done_batches):.0f}s'
        print(
            f'Done with {ns.n_done_batches}/{ns.n_tot_batches}. Time: {t_elapsed:.0f}s / {s_t_left}')
        # Split sleep time so we can react fast when we're done
        for _ in range(int(t_sleep_tot_s/t_react_s)):
            if not statusPrintDone:
                time.sleep(t_react_s)


def updateStatus(ns):
    ns.n_done_batches += 1


def init(embeddings_):
    global embeddings
    embeddings = embeddings_


def getEmbeddingsFromDataframe(df, url, token, max_rows=None):
    global statusPrintDone
    batch_size = 100
    embedding_size = int(768)
    max_mem_usage_mb = 500
    n_rows = len(df.index)
    if max_rows:
        n_rows = min(n_rows, max_rows)
    check_memory_usage(n_rows, max_mem_usage_mb, embedding_size)

    print(f'Getting embeddings for {n_rows} texts')
    n_batches = int(np.ceil(n_rows/batch_size))

    statusPrintDone = False
    ns = mp.Manager().Namespace()
    ns.n_tot_batches = n_batches
    ns.n_done_batches = 0
    ns.t_start = time.time()
    embeddings = mp.Array('f', range(n_rows*embedding_size))
    #ns.embeddings =  np.zeros((n_rows, embedding_size), dtype=np.float32)
    t = Thread(target=printStatus, args=(ns,))
    t.start()

    n_processes = mp.cpu_count()
    print("Number of CPUs available: ", n_processes)
    with mp.Pool(processes=n_processes, initializer=init, initargs=(embeddings,)) as pool:
        # Use starmap_async over starmap so we are able to run keyboard interrupts. Keyboard interrupts are not possible with the
        # synchronous version of (star)map. Reference:
        # https://stackoverflow.com/questions/35908987/multiprocessing-map-vs-map-async
        pool.starmap_async(getEmbeddings, zip(
            chunks(df["text_customer"].head(n_rows), batch_size), np.repeat(url, n_batches), np.repeat(token, n_batches), np.repeat(batch_size, n_batches), np.arange(n_batches), np.repeat(updateStatus, n_batches), np.repeat(ns, n_batches))).get(999999)
    statusPrintDone = True
    t.join()
    print("ALL GOOD IN THE HOOD")
    return np.frombuffer(embeddings.get_obj(), dtype=np.float32).reshape((n_rows, embedding_size))


def filterCsv(fname: str, supportTag: str, n_rows: int = None):
    """
    Filter the given CSV file based on support tag and maximum number of rows

    Parameters
    ----------
    fname : str
        Name of CSV file
    supportTag : str
        Twitter handle for the support team to filter by. Eg. "AmazonHelp"
    n_rows : int | None
        Maximum number of rows to read from CSV file. This maximum is applied before filtering by Twitter handle. None means no filter. Default: None

    Returns
    -------
    A dataframe
    """
    # n_rows = None means no limit
    df = getDataframeFromCsv(fname, n_rows)
    df_filtered = getRootMessagesByReplyAuthorID(df, supportTag)
    return df_filtered


def saveFiles(df_filtered, embeddings, fEmbeddings):
    # df_filtered.to_csv(fFiltered)
    # np.save(fEmbeddings, embeddings)
    print("Saving files..")
    t_start = time.time()
    texts_customer = df_filtered["text_customer"].head(embeddings.shape[0])
    texts_support = df_filtered["text_support"].head(embeddings.shape[0])
    vectorLengths = np.sqrt(
        np.sum(np.multiply(embeddings, embeddings), axis=1))
    jsonData = [{"embedding": embedding.tolist(), "text_customer": text_customer, "text_support": text_support, "length": int(
        length)} for embedding, text_customer, text_support, length in zip(embeddings, texts_customer, texts_support, vectorLengths)]
    jsonData = {"contents": jsonData}
    with open(fEmbeddings, "w") as f:
        json.dump(jsonData, f)
    print(f"Saving files took {time.time()-t_start:.0f}s")


if __name__ == "__main__":
    url = 'https://a.azure-eu-west.platform.peltarion.com/deployment/6b4af091-e459-4dfb-b6a5-d9a93aa73b5b/forward'
    token = '5a7e548f-180e-4aeb-b683-327be197ca39'
    fInput = 'twcs.csv'
    fFiltered = 'output/filtered.csv'
    fEmbeddings = 'output/embeddings.json'
    n_max_rows_read = None
    n_max_rows_use = 10000
    df_filtered = filterCsv(fInput, "AmazonHelp", n_max_rows_read)
    embeddings = getEmbeddingsFromDataframe(
        df_filtered, url, token, n_max_rows_use)
    saveFiles(df_filtered, embeddings, fEmbeddings)
