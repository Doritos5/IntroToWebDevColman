const {
    getCatalog
} = require("../models/catalogModel")

const render = (req, res) => {
    console.log(getCatalog())
    res.render("catalog", getCatalog() );
};

module.exports = {
    render
}