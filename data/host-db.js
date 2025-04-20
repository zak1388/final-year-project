import express from "express";
import sqlite3 from "sqlite3";

const app = express();
const port = 5718;

const db = new sqlite3.Database("cycle-data.db");

app.get("/cycle_parking", (_req, res) => {
    db.all("SELECT * FROM cycle_parking;", [], (err, db_res) => {
        if (err) {
            res.status(500).send();
            return;
        }

        res.send(db_res);
    });
});

app.get("/bike_point", (req, res) => {
    if (req.query.id) {
        // id should look like 'BikePoints_21' probably
        fetch(`https://api.tfl.gov.uk/BikePoint/${req.query.id}`)
        .then(response => {
            if (response.status == 200) return response.json();
            else throw {status: 400, message: `Fetching id '${req.query.id}' failed`, response};
        })
        .then(
            data => res.send(data), 
            err  => err.status? res.status(err.status).send(err) : res.status(500).send({message: "Unknown error", status: 400, err})
        );
    } else {
        // if no id return all bike points
        fetch(`https://api.tfl.gov.uk/BikePoint`)
        .then(response => {
            if (response.status == 200) return response.json();
            else throw {status: 400, message: "Failed to get all bike points.", response};
        })
        .then(
            data => res.send(data), 
            err  => err.status? res.status(err.status).send(err) : res.status(500).send({message: "Unknown error", status: 400, err})
        );
        return;
    }
});

app.get("/usage_stats", (req, res) => {
    let where_clause = req.query.where? " WHERE " + req.query.where + " " : " "
    let query = `SELECT * FROM usage_stats${where_clause}LIMIT 1000;`;
    db.all(query, (err, db_res) => {
        if (err) res.status(500).send({message: "Database error", status: 400, database_error: err, query});
        else res.send(db_res); 
    });
});

app.listen(port, () => {
    console.log(`Database hosted on ${port}`);
});
