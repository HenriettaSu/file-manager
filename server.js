/**
 * Created by Henrie on 5/2/2018.
 */

const config = require('./config.js'),
    path = require('path'),
    express = require('express'),
    timeout = require('connect-timeout'),
    app = express(),
    fs = require('fs'),
    bodyParser = require('body-parser'),
    multer = require('multer'),
    storage = multer.diskStorage({
        destination (req, file, cb) {
            // 文件目錄
            cb(null, './upload')
        },
        filename (req, file, cb) {
            // 文件名稱
            let fileFormat = (file.originalname).split(".");
            cb(null, file.fieldname + '-' + Date.now() + "." + fileFormat[fileFormat.length - 1]);
        }
    }),
    uploader = multer({
        storage: storage
    }),
    log4js = require('log4js'),
    os = require('os'),
    qr = require('qr-image'),
    open = require("open");

log4js.configure({
    appenders: {
        console: { type: 'console' }
    },
    categories: {
        http: { appenders: ['console'], level: 'info' },
        params: { appenders: ['console'], level: 'mark' },
        warner: { appenders: ['console'], level: 'warn' },
        default: { appenders: ['console'], level: 'info' }
    }
});

let connectLogger = log4js.getLogger('http'),
    logger = log4js.getLogger('params'),
    warner = log4js.getLogger('warner');
app.use(log4js.connectLogger(connectLogger, {
    level: 'auto',
    format (req, res, str) {
        let arr = [req.method, req.url.split('?')[0], res.statusCode, res.responseTime + 'ms'];
        return arr.join(' ') + '\n';
    }
}));

app.use(timeout('1200s'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.all('*', (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*"); // 跨域
    res.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT"); // 跨域
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
app.use(express.static(path.join(__dirname, 'static')));

let server,
    uploadApi = () => { // 上傳接口
        app.post(config.uploadUrl, uploader.fields([{name: config.uploadName}]), (req, res) => {
            let files = req.files[config.uploadName];
            logger.info(req.body);
            res.write(JSON.stringify({
                resultCode: "000000",
                resultMsg: 'success',
                data: {
                    len: files.length
                }
            }));
            res.end();
        });
    },
    downloadApi = () => {
        app.get(config.downloadFileUrl, (req, res) => {
            let params = req.query;
            logger.info(params);
            res.download(__dirname + '/upload/' + params.filename);
        });
    };

uploadApi();
downloadApi();

console.log('======== 啟動完畢 ========\n');

server = app.listen(config.port, () => {
    let port = server.address().port,
        addr,
        code,
        ifaces = os.networkInterfaces(),
        iptable = {},
        data = fs.readFileSync('index.html');
    for (let dev in ifaces) {
        ifaces[dev].forEach((details, alias) => {
            if (details.family === 'IPv4') {
                iptable[dev + (alias ? ':' + alias : '')] = details.address;
            }
        });
    }
    addr = 'http://' + iptable['en0:1'] + ':' + port;
    app.get('/', function (req, res) {
        res.send(data.toString().replace(/\${domain}/g, addr));
    });
    code = qr.image(addr, { type: 'png' });
    code.pipe(fs.createWriteStream('static/qr-code.png')).on('close', () => {
        console.log('手機請掃描二維碼\n');
        open(addr + '/qr-code.png');
    });
    console.log('致Root。服務器地址：' + addr + '\n');
});