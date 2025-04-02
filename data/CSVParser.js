import fs from "node:fs/promises";

export default class CSVParser {
    constructor(file_handle) {
        this.file_handle = file_handle;
        this.read_stream = this.file_handle.createReadStream();
        this.file_iterator = this.read_stream.iterator();
        this.read_stream.setEncoding("utf8");
    }

    size;
    async get_size() {
        if (!this.size) {
            const stat = await this.file_handle.stat();
            this.size = stat.size;
        }
        return this.size;
    }

    header;
    async get_header() {
        if (!this.header) this.header = await this._parse_line();
        return this.header;
    }


    last_value = "";
    async _next() {
        if (this.last_value === "") {
            const val = await this.file_iterator.next();
            this.done = val.done;
            this.last_value = val.value;
        }
    }

    async _next_char() {
        if (this.last_value === "") await this._next();
        
        if (this.done) {
            return undefined;
        }


        const last_char = this.last_value[0];
        this.last_value = this.last_value.slice(1);

        if (this.last_value === "") await this._next();

        return last_char;
    }

    async _parse_line() {
        let line = [];
        let cell = "";
        let last_char = await this._next_char();
        while (last_char !== '\n' && last_char != undefined) {
            if (last_char === ',') {
                line.push(cell);
                cell = "";
            } else if (last_char === '\\') {
                cell += last_char;
                cell += _next_char();
            } else if (last_char === "\r") {
            } else {
                cell += last_char;
            }

            last_char = await this._next_char();
        }

        line.push(cell);

        return line;
    }

    async next_csv_line() {
        let obj = {};
        let line = await this._parse_line();
        for (let i = 0; i < this.get_header().length; i++) {
            obj[this.header[i]] = line[i];
        }

        return obj;
    }

    async parse() {
        await this.get_header();
        let all_lines = [];
        while (await this.has_next()) {
            all_lines.push(await this.next_csv_line());
        }
        return all_lines;
    }

    async has_next() {
        return !this.done;
    }

    close() {
        this.read_stream.close();
    }
};

const f = "downloaded/usage-stats/9b-Journey-Data-Extract-06Sep15-19Sep15.csv"; // "./short csv test.csv";

async function main() {
    const c = new CSVParser(await fs.open(f));
    console.log("header: ", await c.get_header());
    console.log();
    const parsed = await c.parse();
    console.log(parsed)
}

if (process.argv[1] === import.meta.filename) {
    main();
}
