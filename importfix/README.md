# ImportFix

Reads and converts data files to Peltarion Platform-compatible import file, eg. comma as column separator.

## Reading CSV files

We use Papa Parse (https://www.papaparse.com/) for reading CSV files

## Reading Excel (xls/xlsx) (NOT IMPLEMENTED)

We use SheetJS (https://github.com/SheetJS/sheetjs) for reading Excel (xls/xlsx) files. The same library supports reading CSV files, but does not comply with RFC4180 according to their own documentation.
List the sheets and let the user select the one where the data exist.
Question: what about formulas, does the library evaluate formulas?

## Reading Google Sheets (NOT IMPLEMENTED)

We use Google Sheet API (https://developers.google.com/sheets/api) for reading Google Sheets.
Question: what about formulas, does the library evaluate formulas?
