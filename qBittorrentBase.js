const got = require('got');
var FormData = require('form-data');

const api = got.extend({
    retry: { limit: 0 },
});

/**
 * 登录qb
 * @returns 
 */
module.exports.qblogin = async () => {
    const qBittorrentURL = process.env.qBittorrentURL
    if (!qBittorrentURL) {
        console.log("未配置环境变量：qBittorrentURL")
        return;
    }
    qBittorrentURL = qBittorrentURL.trimEnd("/");
    var data = new FormData();
    if (!process.env.qbusername || !process.env.qbpassword) {
        console.log("未配置qb 账号密码，跳过登录，可能出现请求拒绝访问（403）")
        return;
    }
    data.append('username', process.env.qbusername);
    data.append('password', process.env.qbpassword);
    var config = {
        method: 'post',
        url: qBittorrentURL + '/api/v2/auth/login',
        body: data
    };
    var cookie = "";
    await api(config).then(async response => {
        cookie = response.headers["set-cookie"][0];
        var SID = cookie.match(/SID=([^; ]+)(?=;?)/)[1]
        cookie = `SID=${SID}`;
        console.log("认证授权Cookie：" + cookie)
    }).catch(async function (error) {
        console.log("qb登录认证出现异常")
        console.log(error)
    });
    return cookie;
}

/**
 * 添加磁力
 * @param {*} cookie 授权token
 * @param {*} urls 磁力信息多个换行
 * @returns 
 */
module.exports.addTorrents = async (cookie, urls) => {
    const qBittorrentURL = process.env.qBittorrentURL
    if (!qBittorrentURL) {
        console.log("未配置环境变量：qBittorrentURL")
        return;
    }
    qBittorrentURL = qBittorrentURL.trimEnd("/");
    var data = new FormData();
    data.append('urls', urls);
    data.append('autoTMM', 'true');
    data.append('paused', 'false');
    data.append('contentLayout', 'Original');
    console.log("磁力信息：" + urls);
    var config = {
        method: 'post',
        url: qBittorrentURL + '/api/v2/torrents/add',
        headers: {
            Cookie: cookie
        },
        body: data
    };
    await api(config).then(async response => {
        console.log(response.body);
        await sendNotify("磁力任务添加结果：" + response.body)
    }).catch(async function (error) {
        await sendNotify(`添加磁力任务失败了：
${error.name}
${error.code}`)
        console.log(error)
    });
}