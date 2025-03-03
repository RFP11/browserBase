var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/chrome-ws', (req, res) => {
  res.render('chrome-ws', { title: 'Express' });
});

module.exports = router;
