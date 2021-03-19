const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const path = require('path');
const fetch = require("node-fetch");
var fs = require('fs');

let embeddingsLibraryAll = null;
let embeddingsLibraryEmbeddings = null;
let embeddingsLibraryLengths = null;

function argMax(array) {
    return [].map.call(array, (x, i) => [x, i]).reduce((r, a) => (a[0] > r[0] ? a : r))[1];
}

function argMin(array) {
    return [].map.call(array, (x, i) => [x, i]).reduce((r, a) => (a[0] < r[0] ? a : r))[1];
}

// function getVectorLength(v) {
//     // Calculate vector length
//     return nj.sqrt(nj.dot(nj.array(v), nj.array(v).T)).get(0);
// }

function dotProduct(a, b) {
    if (Array.isArray(a) && Array.isArray(b) && (a.length === b.length)) {
        let sum = 0;
        for (let i = 0; i < a.length; i++) {
            sum += a[i] * b[i];
        }
        return sum;
    } else {
        return 0;
    }
}

function elementWiseDivide(a, b) {
    if (Array.isArray(a) && Array.isArray(b) && (a.length === b.length)) {
        let ret = new Array(a.length);
        for (let i = 0; i < a.length; i++) {
            ret[i] = a[i] / b[i];
        }
        return ret;
    } else {
        return 0;
    }
}

// Return the n largest indices and their values. Sorted in descending order based on value
function nargmax(arr, n) {
    // Create an array with n elements, all initialized to a value smaller than found in the input matrix
    // Also, register the currently smallest value and idx
    const maxObj = [...Array(n)].map(x => { return { "idx": 0, "val": Math.min(...arr) - 1 } });
    curMinIdx = 0;
    curMinVal = maxObj[0]["val"];

    for (let idx = 0; idx < arr.length; idx++) {
        const v = arr[idx];
        if (v > curMinVal) {
            maxObj[curMinIdx] = { "idx": idx, "val": v };
            curMinIdx = argMin(maxObj.map(x => x["val"]));
            curMinVal = maxObj[curMinIdx]["val"];
        }
    }

    maxObj.sort((a, b) => {
        return b["val"] - a["val"];
    });

    return maxObj;
}

function getTopMatches(embeddingsQuery, numMatches) {
    let dotProducts = [...Array(embeddingsLibraryEmbeddings.length).keys()].map(idx => dotProduct(embeddingsLibraryEmbeddings[idx], embeddingsQuery));
    var m = elementWiseDivide(dotProducts, embeddingsLibraryLengths);
    const maxObj = nargmax(m, numMatches);

    // TODO divide with length of query vector if we want to get similarity measurement

    const ret = maxObj.map(x => {
        return { "customer": embeddingsLibraryAll[x["idx"]]["text_customer"], "support": embeddingsLibraryAll[x["idx"]]["text_support"] };
    });

    return ret;
}

function loadEmbeddingsLibrary() {
    console.log("Loading JSON...");
    embeddingsLibraryAll = JSON.parse(fs.readFileSync('assets/json/embeddings.json', 'utf8'))["contents"];
    embeddingsLibraryEmbeddings = embeddingsLibraryAll.map(x => x["embedding"]);
    embeddingsLibraryLengths = embeddingsLibraryAll.map(x => x["length"]);
    console.log("Done loading JSON..");
}

function getSimilar(query, res) {
    const url = 'https://a.azure-eu-west.platform.peltarion.com/deployment/6b4af091-e459-4dfb-b6a5-d9a93aa73b5b/forward';
    const token = '5a7e548f-180e-4aeb-b683-327be197ca39';
    const data = { "rows": [{ "text_customer": query }] };
    const numReturned = 3;
    (async() => {
        const rawResponse = await fetch(url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + token
            },
            body: JSON.stringify(data)
        });
        const content = await rawResponse.json();
        const retEmbedding = content['rows'][0]['Sentence embedding']['data'];
        ret = getTopMatches(retEmbedding, numReturned);
        res.send(ret);
    })();
}

app.use(express.static(path.join(__dirname, 'assets')));
app.use(express.json());
loadEmbeddingsLibrary();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/index.html'));
})

app.post('/query', (req, res) => {
    getSimilar(req.body.query, res);
})

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})