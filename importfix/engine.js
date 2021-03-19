class ImportFix {

    ErrorTypes = Object.freeze({ "emptyCell": 1, "other": 2 });

    constructor() {
        this.uploadedData = [];
        this.info = {}
    }

    addUploadedDataRow(row) {
        if ((row.length === 1) && (!row[0])) {
            // Skip completely blank rows
            this.infoLog("Skipped blank row");
        } else {
            this.uploadedData.push(row);
        }
    }

    infoLog(str) {
        const doLogInfo = true;
        if (doLogInfo) {
            console.log("INFO: " + str);
        }
    }

    warningLog(str) {
        console.log("WARNING: " + str);
    }

    errorLog(str) {
        console.log("ERROR: " + str);
    }

    // Returns the file extension in lowercase. If a file extension can't be found,
    //  return null
    getFileExtension(file) {
        if (file && file.name) {
            return file.name.split('.').pop().toLowerCase();
        } else {
            return null;
        }
    }

    downloadCSV(fileName = 'download.csv') {
        const cleanedData = this.getCleanedData();
        if (cleanedData) {
            var csv = Papa.unparse(cleanedData);
            var csvData = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            var csvURL = null;
            if (navigator.msSaveBlob) {
                csvURL = navigator.msSaveBlob(csvData, fileName);
            }
            else {
                csvURL = window.URL.createObjectURL(csvData);
            }

            var tempLink = document.createElement('a');
            tempLink.href = csvURL;
            tempLink.setAttribute('download', fileName);
            tempLink.click();
        } else {
            this.warningLog("No data to download");
        }
    }

    getEmptyRowIndices() {

    }

    getIndicesToRemove() {
        let rowIdxToRemove = [];
        const dataOriginal = this.uploadedData;

        for (let rowIdx = 0; rowIdx < dataOriginal.length; rowIdx++) {
            if (Array.isArray(dataOriginal[rowIdx])) {
                for (let colIdx = 0; colIdx < dataOriginal[rowIdx].length; colIdx++) {
                    if (!dataOriginal[rowIdx][colIdx]) {
                        rowIdxToRemove.push({ rowIdx: rowIdx, errType: this.ErrorTypes.emptyCell });
                        break;
                    }
                }
            } else {
                // One of the rows is not an array. Shouldn't be the case
                this.errorLog("Row " + str(rowIdx + 1) + " is not an array");
                return null;
            }
        }

        return rowIdxToRemove;
    }

    getCleanedData() {
        if (Array.isArray(this.uploadedData)) {
            let rowIndicesToRemove = this.getIndicesToRemove();
            // Copy the data array
            let dataCleaned = [...this.uploadedData];
            // Inverse so we can remove from the end
            rowIndicesToRemove = rowIndicesToRemove.reverse();
            rowIndicesToRemove.forEach(x => dataCleaned.splice(x.rowIdx, 1));
            return dataCleaned;
        } else {
            return null;
        }
    }

    doneReadingData(callbackFn) {
        this.infoLog("Done uploading data");
        const invalidRowIndices = this.getIndicesToRemove();
        const numRowsOriginal = this.uploadedData.length;
        const numRowsRemoved = invalidRowIndices ? invalidRowIndices.length : 0;
        const numRowsAfterClean = numRowsOriginal - numRowsRemoved;
        const numFeatures = this.uploadedData[0].length;
        this.info = {
            numRowsOriginal: numRowsOriginal,
            numRowsAfterClean: numRowsAfterClean,
            numRowsRemoved: numRowsRemoved,
            numFeatures: numFeatures
        };
        callbackFn();
    }

    resetResult() {
        this.uploadedData = [];
    }

    readContentCSVData(data, callbackFn) {
        this.resetResult();
        const readData = Papa.parse(data, {
            header: false,  // Deactivate since we want to control this ourselves
            skipEmptyLines: false,
            preview: 100000 // Maximum number of lines to read. This includeds the header, if any
        });
        readData.data.forEach(x => this.addUploadedDataRow(x));
        this.doneReadingData(callbackFn);
    }

    readContentCSVFile(file, callbackFn) {
        this.resetResult();
        const self = this;
        return Papa.parse(file, {
            worker: true,
            header: false,  // Deactivate since we want to control this ourselves
            skipEmptyLines: false,
            preview: 100000, // Maximum number of lines to read. This includes the header, if any
            step: function (row) {
                self.addUploadedDataRow(row.data);
            },

            complete: function () {
                self.doneReadingData(callbackFn);
            }
        });
    }

    readContentExcelSheet(file, sheetName, callbackFn) {
        const self = this;
        var reader = new FileReader();
        reader.onload = function (e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array', sheets: [sheetName] });
            const sheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(sheet);
            self.readContentCSVData(csv, callbackFn);
        };
        reader.readAsArrayBuffer(file);
        return null;
    }

    readSheetNames(file, callbackFn) {
        const self = this;
        var reader = new FileReader();
        reader.onload = function (e) {
            var data = new Uint8Array(e.target.result);
            var workbook = XLSX.read(data, { type: 'array', bookSheets: true });
            const sheetNames = workbook.SheetNames;
            callbackFn(file, sheetNames);
        };
        reader.readAsArrayBuffer(file);
        return null;
    }

    readContentGoogleSheets(file) {
        // NOT IMPLEMENTED
        return null;
    }

    fileIsOfType(file, ext) {
        return ext.includes(this.getFileExtension(file));
    }

    fileIsExcel(file) {
        return this.fileIsOfType(file, ["xls", "xlsx"]);

    }

    fileIsCsv(file) {
        return this.fileIsOfType(file, ["csv"]);
    }

    // readContent(file, callbackFn) {
    //     this.uploadedData = [];
    //     switch (this.getFileExtension(file)) {
    //         case "csv": return this.readContentCSVFile(file, callbackFn);
    //         case "xls": return this.readContentExcel(file, callbackFn);
    //         case "xlsx": return this.readContentExcel(file, callbackFn);
    //         default: return null;
    //     }
    // }

    // upload(file, callbackFn) {
    //     this.infoLog("Start upload");

    //     if (files.length === 1) {
    //         // Get the first file
    //         this.readContent(files[0], callbackFn);
    //     } else if (files.length > 1) {
    //         this.warningLog("Multiple files selected");
    //     } else {
    //         this.warningLog("No file selected");
    //     }

    // }
}