var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors =  require('cors');
var puppeteer = require('puppeteer');
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const { getStream } = require("puppeteer-stream");
const WebSocket = require("ws");
const http = require("http");
const { createProxyMiddleware } = require("http-proxy-middleware");

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(cors())

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


app.use(
  "/proxy",
  createProxyMiddleware({
    target: "https://www.google.com",
    changeOrigin: true,
    selfHandleResponse: true,
    onProxyRes: (proxyRes, req, res) => {
      delete proxyRes.headers["x-frame-options"];
      delete proxyRes.headers["content-security-policy"];
    },
  })
);


app.use('/', indexRouter);
app.use('/users', usersRouter);

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let browser, page, stream;

// Start Puppeteer
async function startBrowser() {
    if (!browser) {
        browser = await puppeteer.launch({
            headless: false,
            args: ["--remote-debugging-port=9222", "--no-sandbox"],
        });

        page = await browser.newPage();
        await page.goto("https://www.google.com");
    }
}

// WebSocket connection for streaming
wss.on("connection", async (ws) => {
    if (!browser) await startBrowser();
    if (!page) return ws.send(JSON.stringify({ error: "Page not available" }));

    console.log("Client connected for streaming");

    // Start video streaming
    stream = await getStream(page, { audio: false, video: true, mimeType: "video/webm" });

    stream.on("data", (chunk) => {
        ws.send(chunk);
    });

    // Handle mouse and keyboard events
    ws.on("message", async (message) => {
        const event = JSON.parse(message);

        if (event.type === "click") {
            await page.mouse.click(event.x, event.y);
        } else if (event.type === "keydown") {
            await page.keyboard.down(event.key);
        } else if (event.type === "keyup") {
            await page.keyboard.up(event.key);
        }
    });

    ws.on("close", () => {
        console.log("Client disconnected");
        if (stream) stream.destroy();
    });
});

// Start browser route
app.get("/start-chrome", async (req, res) => {
    await startBrowser();
    res.json({ message: "Chrome started!" });
});

// Close browser route
app.get("/close-chrome", async (req, res) => {
    if (browser) {
        await browser.close();
        browser = null;
        res.json({ message: "Chrome closed" });
    } else {
        res.json({ message: "Chrome is not running" });
    }
});
// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
