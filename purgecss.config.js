// purgecss.config.js
module.exports = {
    // 1) point at every file that contains markup or class-names:
    content: [
        './index.html',
        './report.html',
        './js/**/*.js'
    ],
    // 2) your stylesheets to clean:
    css: ['./style.css'],
    // 3) extractor: catch any “foo-bar” or camelCase you might have in JS strings:
    defaultExtractor: content => {
        // grab anything that looks like a class, id, or JS-generated name
        return content.match(/[A-Za-z0-9-_:/]+/g) || [];
    },
    // 4) optional safelist for dynamic names you know you’ll use at runtime
    safelist: [
        // e.g. /^modal-/,  // any class that starts with “modal-”
        // 'active', 'hidden' // specific ones
    ]
}
