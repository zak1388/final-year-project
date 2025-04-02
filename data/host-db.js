import express from "express";
import sqlite3 from "sqlite3";

const app = express();
const port = 5718;

const db = new sqlite3.Database("cycle-data.db");

app.get("/cycle_parking", (_req, res) => {
    db.all("SELECT * FROM cycle_parking;", [], (err, db_res) => {
        if (err) {
            res.statusCode(500).send();
            return;
        }

        res.send(db_res);
    });
});

app.listen(port, () => {
    console.log(`Database hosted on ${port}`);
});
