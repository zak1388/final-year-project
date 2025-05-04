import './style.css';
import {Map, View} from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import Overlay from "ol/Overlay.js";
import Control from "ol/control/Control.js";
import {defaults as default_controls} from "ol/control/defaults.js";
import {useGeographic} from "ol/proj.js";

const TIME_DELTA = 15 * 60 // Time period in seconds

useGeographic();

const control_container = document.createElement("div");
control_container.style.top = "1em";
control_container.style.right = "1em";
control_container.style.position = "absolute";
control_container.style.display = "flex";
control_container.style.flexDirection = "column";
control_container.style.gap = "0.5em";

let controls = default_controls();
controls.push(new Control({element: control_container}));
const map = new Map({
    target: 'map',
    controls,
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
        element.classList.add("BikePoint");

        element.marker = document.createElement("marker");
        element.marker.style.width = "10px";
        element.marker.style.height = "10px";
        element.marker.style.borderRadius = "5px";
        element.marker.style.backgroundColor = this._color;
        // element.marker.style.opacity = this._opacity;
        element.marker.style.display = "block";
        element.appendChild(element.marker);

        element.label = document.createElement("div");
        element.label.classList.add("label");
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

            canvas.style.pointerEvents = "none";
            canvas.style.border = "1px solid black";
            canvas.style.position = "absolute";
            canvas.style.x = "0px";
            canvas.style.y = "0px";
            canvas.style.width = "100%";
            canvas.style.height = "100%";

            document.body.appendChild(canvas);

            fetch(`/api/usage_stats?distinct=1&where=StartStationID="${/\d+/.exec(point.id)[0]}"`)
            .then(resp => resp.json())
            .then(usage_stats => {
                let redraw = () => {
                    const ctx = canvas.getContext("2d");
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.lineWidth = 1;

                    let rect = element.marker.getBoundingClientRect();
                    const [x, y] = [(rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2];

                    let i = 0;
                    usage_stats.forEach(row => {
                        ctx.beginPath();
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
                }
                redraw();
                map.addEventListener("moveend", () => redraw());
                const close_button = document.createElement("button");
                close_button.innerHTML = "Close paths overlay";
                close_button.style.width = "16em";
                close_button.addEventListener("click", (e) => {
                    canvas.remove();
                    close_button.remove();
                });
                control_container.appendChild(close_button);
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

function lerp(start, end, f) {
    return start + ((end - start) * f);
}

let bike_stations_points = null;
fetch("/api/bike_point")
    .then(res => res.json())
    .then(stations => stations.map(station => new MapPoint(station.id, station.lon, station.lat)))
    .then(stations_points => bike_stations_points = new BikeMapPoints(stations_points));

class FlowButton {

    container_element;
    button_element;
    gradient_element;
    time_slider_element;
    enabled = false;
    data;

    onEnabled;
    onDisabled;

    constructor(default_text, onEnabled, onDisabled, onTimeChange) {
        this.onEnabled = onEnabled;
        this.onDisabled = onDisabled;

        this.container_element = document.createElement("div");
        this.container_element.style.width = "15em";
        control_container.appendChild(this.container_element); 

        this.button_element = document.createElement("button")
        this.button_element.addEventListener("click", (e) => this.onClick(e));
        this.button_element.style.width = "16em";
        this.container_element.appendChild(this.button_element); 
        this.setButtonText(default_text);

        this.gradient_element = document.createElement("div");
        this.gradient_element.style.position = "absolute";
        this.gradient_element.style.top = "0em";
        this.gradient_element.style.right = "calc(100% + 1em)";
        this.gradient_element.style.display = "none";
        this.gradient_element.style.width = "100%";
        this.gradient_element.style.padding = window.getComputedStyle(this.button_element).padding;
        this.gradient_element.style.boxSizing = "border-box";
        this.gradient_element.style.backgroundImage = "linear-gradient(to right, rgb(255, 0, 0), rgb(0, 0, 255))";
        const gradient_text_low  = this.gradient_element.appendChild(document.createElement("span"));
        gradient_text_low.style.paddingLeft = "1em";
        gradient_text_low.innerHTML = "Low";
        const gradient_text_sep = this.gradient_element.appendChild(document.createElement("span"));
        gradient_text_sep.style.flexGrow = "1";
        const gradient_text_high = this.gradient_element.appendChild(document.createElement("span"));
        gradient_text_high.style.paddingRight = "1em";
        gradient_text_high.style.color = "white";
        gradient_text_high.innerHTML = "High";
        this.container_element.appendChild(this.gradient_element);

        this.time_container = document.createElement("span");
        this.time_container.style.position = "absolute";
        this.time_container.style.display = "none";
        this.time_container.style.flexDirection = "row";
        this.time_container.style.top = "2em";
        this.time_container.style.right = "calc(100% + 1em)";
        this.time_container.style.width = "100%";
        this.container_element.appendChild(this.time_container);

        this.time_slider_element = document.createElement("input");
        this.time_slider_element.min = 0;
        this.time_slider_element.type = "range";
        this.time_slider_element.max = 24 * 60 * 60 - TIME_DELTA;
        this.time_slider_element.step = TIME_DELTA;
        this.time_slider_element.addEventListener("input", (e) => onTimeChange(e, this));


        const timeFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: "utc", timeStyle: "short" });
        const formatTime = () => {
            let [d1, d2] = this.getTimePeriod();
            return timeFormatter.format(d1) + " - " + timeFormatter.format(d2);
        };
        this.time_slider_label = document.createElement("label");
        this.time_slider_label.style.backgroundColor = "white";
        this.time_slider_label.innerHTML = formatTime();
        this.time_slider_element.addEventListener("input", (e) => this.time_slider_label.innerHTML = formatTime());
        this.time_slider_label.for = this.time_slider_element;
        this.time_container.appendChild(this.time_slider_label);
        this.time_container.appendChild(this.time_slider_element);
    }

    getTimePeriod() {
        const v = Number(this.time_slider_element.value);
        const v1 = v * 1000
        const v2 = (v + TIME_DELTA) * 1000;
        const d1 = new Date(v1);
        const d2 = new Date(v2);
        return [d1, d2];
    }

    onClick(e) {
        this.enabled ^= true;
        if (this.enabled) {
            this.onEnabled(e, this);
        } else {
            this.onDisabled(e, this);
        }
    }

    setButtonText(text) {
        if (this.button_text_element) {
            this.button_text_element.remove();
        }
        this.button_text_element = this.button_element.appendChild(document.createElement("span"));
        this.button_text_element.innerHTML = text;
    }

    setSliderDisplay(onOff) {
        if (onOff) {
            this.time_container.style.display = "flex";
        } else {
            this.time_container.style.display = "none";
        }
    }

    setGradientDisplay(onOff) {
        if (onOff) {
            this.gradient_element.style.display = "flex";
        } else {
            this.gradient_element.style.display = "none";
        }
    }
}

function drawOutFlow(this_obj) {
    let min = Infinity;
    let max = -Infinity;

    const data = this_obj.data.filter(v => v["TimeStart"] == this_obj.time_slider_element.value);

    for (const row of data) {
        let count = Number(row["CountOut"]);
        if (min > count) min = count;
        if (max < count) max = count;
    }
    let range = max - min;
    for (const row of data) {
        let marker = document.querySelector(`#BikePoints_${row["StationID"]} > marker`);
        if (!marker) continue;

        let label_outflow_text = marker.parentNode.querySelector(".OutFlowText");
        if (!label_outflow_text) {
            label_outflow_text = marker.parentNode.querySelector(".label").appendChild(document.createElement("p"));
            label_outflow_text.style.margin = "0";
            label_outflow_text.classList.add("OutFlowText");
        }
        label_outflow_text.innerHTML = "Bicycle's leaving: " + row["CountOut"];

        let f = (Number(row["CountOut"]) - min)/range;
        marker.style.backgroundColor = `rgb(${lerp(255, 0, f)}, 0, ${lerp(0, 255, f)})`;
    }
}

const outflow_button = new FlowButton(
    "Display station outflows",
    (e, this_obj) => {
        if (inflow_button.enabled) {
            inflow_button.enabled = false;
            inflow_button.onDisabled(null, inflow_button);
        }

        this_obj.setButtonText("Getting data...");
        if (this_obj.data) {
            drawOutFlow(this_obj);
            this_obj.setGradientDisplay(true);
            this_obj.setSliderDisplay(true);
            this_obj.setButtonText("Stop displaying station outflows");
        } else {
            const err_handler = err => {
                this_obj.setButtonText("Failed to get data");
                console.error(err);
            }
            fetch("/api/connection_stats/out")
                .then(data => data.json(), err_handler)
                .then(json_data_res => this_obj.data = json_data_res, err_handler)
                .then(() => {
                    drawOutFlow(this_obj);
                    this_obj.setGradientDisplay(true);
                    this_obj.setSliderDisplay(true);
                    this_obj.setButtonText("Stop displaying station outflows");
                }, err_handler);
        }
    },
    (e, this_obj) => {
        document.querySelectorAll(".BikePoint > marker").forEach(marker => {
            marker.style.backgroundColor = bike_stations_points._color;
        });
        document.querySelectorAll(".BikePoint .OutFlowText").forEach(div => {
            div.remove();
        });
        this_obj.setButtonText("Display station outflows");
        this_obj.setGradientDisplay(false);
        this_obj.setSliderDisplay(false);
    },
    (e, this_obj) => {
        drawOutFlow(this_obj);
    }
);


function drawInFlow(this_obj) {
    let min = Infinity;
    let max = -Infinity;

    const data = this_obj.data.filter(v => v["TimeEnd"] == this_obj.time_slider_element.value);

    for (const row of data) {
        let count = Number(row["CountIn"]);
        if (min > count) min = count;
        if (max < count) max = count;
    }
    let range = max - min;
    for (const row of data) {
        let marker = document.querySelector(`#BikePoints_${row["StationID"]} > marker`);
        if (!marker) continue;

        let label_outflow_text = marker.parentNode.querySelector(".InFlowText");
        if (!label_outflow_text) {
            label_outflow_text = marker.parentNode.querySelector(".label").appendChild(document.createElement("p"));
            label_outflow_text.style.margin = "0";
            label_outflow_text.classList.add("InFlowText");
        }
        label_outflow_text.innerHTML = "Bicycle's entering: " + row["CountIn"];

        let f = (Number(row["CountIn"]) - min)/range;
        marker.style.backgroundColor = `rgb(${lerp(255, 0, f)}, 0, ${lerp(0, 255, f)})`;
    }
}

const inflow_button = new FlowButton(
    "Display station inflows",
    (e, this_obj) => {
        if (outflow_button.enabled) {
            outflow_button.enabled = false;
            outflow_button.onDisabled(null, outflow_button);
        }
        this_obj.setButtonText("Getting data...");
        if (this_obj.data) {
            drawInFlow(this_obj);
            this_obj.setGradientDisplay(true);
            this_obj.setSliderDisplay(true);
            this_obj.setButtonText("Stop displaying station inflows");
        } else {
            const err_handler = err => {
                this_obj.setButtonText("Failed to get data");
                console.error(err);
            }
            fetch("/api/connection_stats/in")
                .then(data => data.json(), err_handler)
                .then(json_data_res => this_obj.data = json_data_res, err_handler)
                .then(() => {
                    drawOutFlow(this_obj);
                    this_obj.setGradientDisplay(true);
                    this_obj.setSliderDisplay(true);
                    this_obj.setButtonText("Stop displaying station inflows");
                }, err_handler);
        }
    },
    (e, this_obj) => {
        document.querySelectorAll(".BikePoint > marker").forEach(marker => {
            marker.style.backgroundColor = bike_stations_points._color;
        });
        document.querySelectorAll(".BikePoint .InFlowText").forEach(div => {
            div.remove();
        });
        this_obj.setButtonText("Display station inflows");
        this_obj.setGradientDisplay(false);
        this_obj.setSliderDisplay(false);
    },
    (e, this_obj) => {
        drawInFlow(this_obj);
    }
);

// window.addEventListener("click", (e) => console.log(e));
// map.addEventListener("click", (e) => console.log(e));
