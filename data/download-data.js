import fs from "node:fs/promises";
import fsSync from "node:fs";

const DOWNLOAD_FOLDER = "downloaded/";

if (!fsSync.statSync(DOWNLOAD_FOLDER, {throwIfNoEntry: false})) {
    fsSync.mkdirSync(DOWNLOAD_FOLDER);
}

function getFileNameFromURL(url) {
    const url_string = url.toString();
    const file_name = decodeURI(url_string.substring(url_string.lastIndexOf('/') + 1)); // todo: keep the file structure
    return DOWNLOAD_FOLDER + file_name;
}


fs.readFile('./links.txt', {encoding: "utf8"})
    .then(links => links.split("\n"))
    .then(links_arr => {
        const data_file_promises = links_arr.map(link => {
            if (!URL.canParse(link)) {
                return Promise.reject(`Invalid link '${link}'`);
            } else if (fsSync.statSync(getFileNameFromURL(link), {throwIfNoEntry: false})) {
                return Promise.reject(`Already downloaded '${link}'`);
            }
            console.log("downloading " +  link);
            return fetch(link);
        });
        return data_file_promises; // todo: change this, not very async
    })
    .then(response_promises => response_promises.forEach(
        response_promise => response_promise.then(data_file_response => {
            const file_name = getFileNameFromURL(data_file_response.url);
            console.log("Saving '" + file_name + "'");
            fs.writeFile(file_name, data_file_response.body);
        }).catch(err => console.error(err)))
    );
            
