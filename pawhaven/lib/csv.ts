// Quoting prevents delimiter injection; the apostrophe prevents spreadsheet formulas.
export function csvCell(value:unknown) {
 let text=String(value??'');
 if(/^\s*[=+@-]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;
 return '"'+text.replaceAll('"','""')+'"';
}
