import './style.css';
import {Map, View} from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import Overlay from "ol/Overlay.js";
import {useGeographic} from "ol/proj.js";

useGeographic();

const map = new Map({
  target: 'map',
  layers: [
    new TileLayer({
      source: new OSM()
    })
  ],
  view: new View({
    center: [-0.2, 51.50],
    zoom: 10
  })
});

class MapPoint {
    _latitude;
    _longitude;
    _id;

    constructor(id, longitude, latitude) {
        this._id = id;
        this._longitude = longitude;
        this._latitude = latitude;
    }

    get id() {
        return this._id;
    }

    get longitude() {
        return this._longitude;
    }

    get latitude() {
        return this._latitude;
    }
}


class MapPoints {
     _drawn_overlays = [];
    _points = [];

    _color = "red";
    _opacity = 0.5;

    _drawLimit = 500

    constructor(points) {
        this._points = points;
        // map.addEventListener("moveend", () => this.draw());
        this.draw();
    }

    _createElement(point) {
        let element = document.createElement("div");
        element.id = point.id;

        element.marker = document.createElement("marker");
        element.marker.style.width = "10px";
        element.marker.style.height = "10px";
        element.marker.style.borderRadius = "5px";
        element.marker.style.backgroundColor = this._color;
        element.marker.style.opacity = this._opacity;
        element.marker.style.display = "block";
        element.appendChild(element.marker);

        element.label = document.createElement("div");
        element.label.innerHTML = point.id;
        element.label.style.display = "none";
        element.label.style.backgroundColor = "white";
        element.label.style.border = "1px solid black";
        element.addEventListener("mouseenter", () => element.label.style.display = "block");
        element.addEventListener("mouseout", () => element.label.style.display = "none");
        element.appendChild(element.label);

        return element;
    }

    _updateElement(element, point) {
        element.id = point.id;
        element.style.display = "block";
        element.label.innerHTML = point.id;
    }

    draw() {
        const points_inside = this._points.filter(point => map_contains(point.latitude, point.longitude));
        const count_inside =  points_inside.length;

        // dont render if too many elements to draw
        if (false && count_inside > this._drawLimit) {
            this._drawn_overlays.forEach(drawn_overlay => {
                drawn_overlay.getElement().style.display = "none";
            });
            return;
        }

        let count = 0;
        for (const point of points_inside) {
            if (this._drawn_overlays.length <= count) {
                const overlay = new Overlay({
                    position: [point.longitude, point.latitude],
                    element: this._createElement(point)
                });
                map.addOverlay(overlay);
            } else {
                const overlay = this._drawn_overlays[count];
                overlay.getElement().remove();
                overlay.setPosition([point.longitude, point.latitude]);
                overlay.setElement(this._createElement(point));
            }


            count++;
        }

        // clear the rest of them
        for (let i = count; i < this._drawn_overlays.length; i++) {
            this._drawn_overlay.setPosition(null);
            this._drawn_overlay.getElement().remove();
            this._drawn_overlay.setElement(null);
        }
    }
}

class BikeMapPoints extends MapPoints {
    constructor(points) {
        super(points);
    }

    _createElement(point) {
        let element = document.createElement("div");
        element.id = point.id;

        element.marker = document.createElement("marker");
        element.marker.style.width = "10px";
        element.marker.style.height = "10px";
        element.marker.style.borderRadius = "5px";
        element.marker.style.backgroundColor = this._color;
        element.marker.style.opacity = this._opacity;
        element.marker.style.display = "block";
        element.appendChild(element.marker);

        element.label = document.createElement("div");
        element.label.innerHTML = point.id;
        element.label.style.display = "none";
        element.label.style.backgroundColor = "white";
        element.label.style.border = "1px solid black";
        element.addEventListener("mouseenter", () => element.label.style.display = "block");
        element.addEventListener("mouseout", () => element.label.style.display = "none");
        element.appendChild(element.label);

        element.addEventListener("click", (e) => {
            const canvas = document.createElement("canvas");
            canvas.width = document.body.getBoundingClientRect().width;
            canvas.height = document.body.getBoundingClientRect().height;

            canvas.style.border = "1px solid black";
            canvas.style.position = "absolute";
            canvas.style.x = "0px";
            canvas.style.y = "0px";
            canvas.style.width = "100%";
            canvas.style.height = "100%";

            fetch(`/api/usage_stats?where=StartStationID="${/\d+/.exec(point.id)[0]}"`)
            .then(resp => resp.json())
            .then(usage_stats => {
                const ctx = canvas.getContext("2d");
                ctx.lineWidth = 1;

                let rect = element.getBoundingClientRect();
                const [x, y] = [rect.x + (rect.width / 2), rect.y + (rect.height / 2)];

                console.log([x, y]);

                let i = 0;
                usage_stats.forEach(row => {
                    ctx.moveTo(x, y);
                    let otherId = "BikePoints_" + row.EndStationID;
                    let otherElement = document.getElementById(otherId);
                    if (!otherElement) return;
                    rect = otherElement.getBoundingClientRect();
                    const [otherX, otherY] = [rect.x + (rect.width / 2), rect.y + (rect.height / 2)];
                    ctx.lineTo(otherX, otherY);
                    ctx.stroke();
                    i++;
                });

                canvas.addEventListener("click", () => canvas.remove());
                console.warn("Drew " + i + " lines");

                document.body.appendChild(canvas);
            });
        });

        return element;
    }

    _updateElement(element, point) {
        element.id = point.id;
        element.style.display = "block";
        element.label.innerHTML = point.id;
    }
}

function map_contains(lat, lon) {
    let [x_pixel, y_pixel] = map.getPixelFromCoordinate([lon, lat]);
    if (x_pixel < 0 || x_pixel > map.getSize()[0]) {
        return false;
    } else if (y_pixel < 0 || y_pixel > map.getSize()[1]) {
        return false;
    }
    return true;
}

let drawn_cycle_parking = [];
function draw_cycle_parking(cycle_parking, max_count) {
    const count_inside = cycle_parking.reduce((sum_inside, parking_spot) => {
        const c = map_contains(parking_spot);
        return sum_inside +  (c ? 1 : 0);
    }, 0);

    if (false && count_inside > max_count) {
        drawn_cycle_parking.forEach(parking_element => {
            parking_element.style.display = "none";
        });
        return;
    }


    let count = 0;
    for (const parking_spot of cycle_parking) {
        if (!map_contains(parking_spot)) {
            continue;
        }
    
        let element;
        if (drawn_cycle_parking.length <= count) {
            // createElement
        } else {
            element = drawn_cycle_parking[count];
            // updateElement
        }

        map.addOverlay(new Overlay({
            position: [parking_spot.Latitude, parking_spot.Longitude],
            element: element
        }));

        count++;
    }
}

/*
let cycle_parking = null;
async function get_cycle_parking() {
    const cycle_parking_raw = await fetch("/api/cycle_parking");
    cycle_parking = await cycle_parking_raw.json();
    let max_count = 500;
    map.addEventListener("moveend", () => draw_cycle_parking(cycle_parking, max_count));
    draw_cycle_parking(cycle_parking, max_count);
}
get_cycle_parking();
*/


let bike_stations_points = null;
fetch("/api/bike_point")
    .then(res => res.json())
    .then(stations => stations.map(station => new MapPoint(station.id, station.lon, station.lat)))
    .then(stations_points => bike_stations_points = new BikeMapPoints(stations_points));

window.addEventListener("click", (e) => console.log(e));
// map.addEventListener("click", (e) => console.log(e));
