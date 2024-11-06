import fs from "node:fs/promises";
import fsSync from "node:fs";

const DOWNLOAD_FOLDER = "downloaded/"; // must end in a '/'

function createFolderIfNotExists(path) {
    if (!fsSync.statSync(path, {throwIfNoEntry: false})) {
        fsSync.mkdirSync(path);
    }
}

createFolderIfNotExists(DOWNLOAD_FOLDER);

function getRelativePath(url) {
    return DOWNLOAD_FOLDER + url.pathname.substring(1); // ignore first slash
}

function* getRelativePathSplitByFolders(url) {
    let remaining_path = getRelativePath(url);

    while (remaining_path.length > 0) {
        const first_idx = remaining_path.indexOf('/');

        if (first_idx !== -1) {
            yield remaining_path.substring(0, first_idx + 1);
            remaining_path = remaining_path.substring(first_idx + 1);
        } else {
            return remaining_path;
        }
    }

    return ""; // this must mean that this is not a file
}

function saveFromResponse(data_file_response) {
    console.log("Saving '" + getRelativePath(new URL(data_file_response.url)) + "'");
    let path = "";
    for (let path_segment of getRelativePathSplitByFolders(new URL(data_file_response.url))) {
        path += path_segment;
        createFolderIfNotExists(path);
    }
    fs.writeFile(getRelativePath(new URL(data_file_response.url)), data_file_response.body);
}

function main() {
    fs.readFile('./links.txt', {encoding: "utf8"})
        .then(links => links.split("\n"))
        .then(links_arr => {
            const data_file_promises = links_arr.map(link => {
                if (!URL.canParse(link)) {
                    return Promise.reject(`Invalid link '${link}'`);
                } else if (fsSync.statSync(getRelativePath(new URL(link)), {throwIfNoEntry: false})) {
                    return Promise.reject(`Already downloaded '${link}'`);
                }
                console.log("downloading " +  link);
                return fetch(link);
            });
            return Promise.allSettled(data_file_promises);
        })
        .then(response_promises => response_promises.forEach(
            response_promise => {
                if (response_promise.status === "fulfilled") {
                    saveFromResponse(response_promise.value)
                } else {
                    console.error(response_promise.reason);
                }
            }));
}
            
main();
