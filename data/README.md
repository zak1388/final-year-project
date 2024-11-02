Extracted all the links from the tfl page
Used (in the browser console):
```js
Array.from(document.querySelectorAll("a"))
    .map(a => a.href)
    .filter(link => link.indexOf("cycling") !== -1)
    .reduce((str, cv) => str + cv + "\n", "");
```
to get all the links from [tfl's website](https://cycling.data.tfl.gov.uk/)

These can be found in [links.txt](./links.txt).
