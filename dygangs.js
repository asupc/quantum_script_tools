/**
 * 电影港续集监听
 * 
 * 手动执行一次脚本 自动生成自定义数据  影视监听配置 ， 影视监听记录
 * 
 * 手动添加 影视监听配置 ，配置需要监听的剧集的详情页 比如：https://www.dygangs.net/dmq/20211031/48089.htm，自动下载配置”是/否“，自动下载需要配置QB相关信息，是否启用”是否“
 * 
 */

const cheerio = require('cheerio');
const { api, sendNotify, addOrUpdateCustomDataTitle, getCustomData, addCustomData } = require('../quantum');

const { qblogin, addTorrents } = require("./qBittorrentBase")

const iconv = require('iconv-lite');



const customDataType = "video_update_monitoring_history"
const urlConfigDataType = "video_update_monitoring_item"

/** 需要匹配的高清分辨率关键字 */
const HIGH_RES_KEYWORDS = ['2160P', '4K'];

/**
 * 判断剧集标题是否包含高清分辨率关键字
 * @param {string} title - 剧集标题
 * @returns {boolean}
 */
function isHighResolution(title) {
    return HIGH_RES_KEYWORDS.some(keyword => title.includes(keyword));
}

/**
 * 从标题中提取可读的剧集信息
 * 标题格式: [前缀.]集数.分辨率.其余 → 返回 "前缀 第xx集"
 * 示例:
 *   "148.2160P.HD国语中字无水印.MP4"      → "第148集"
 *   "第三季49.2160P.HD国语中字无水印.MKV"  → "第三季 第49集"
 *   "重返天南02.2160P.HD国语中字无水印.MP4" → "重返天南 第02集"
 *   "88-89.1080P.HD国语中字无水印.MP4"     → "第88-89集"
 *   "虚天战纪.导演剪辑版.2160P..."         → "导演剪辑版"
 * @param {string} title - 原始剧集标题
 * @returns {string} 格式化后的剧集信息
 */
function extractEpisodeInfo(title) {
    const resPattern = HIGH_RES_KEYWORDS.join('|');
    const match = title.match(new RegExp(`^(?:.*\\.)?(.+?)\\.(?:${resPattern})\\.`));
    if (!match) return title;

    const segment = match[1];
    // 分离中文前缀和末尾数字: "重返天南02" → prefix="重返天南", num="02"
    const numMatch = segment.match(/^(.+?)?(\d+(?:-\d+)?)$/);
    if (numMatch) {
        const prefix = numMatch[1] || '';
        const number = numMatch[2];
        return prefix ? `${prefix} 第${number}集` : `第${number}集`;
    }

    return segment;
}

!(async () => {

    await init();

    const dygangsUrls = await getCustomData(urlConfigDataType, null, null, {
        Data4: "是"
    });

    for (let p = 0; p < dygangsUrls.length; p++) {
        const dygangsUrl = dygangsUrls[p];
        let videoName = dygangsUrl.Data1;
        let url = dygangsUrl.Data2;
        const response = await api(url, { responseType: 'buffer' });
        // const html = response.body; // 或根据需要的编码更改
        const html = iconv.decode(response.body, 'gb2312'); // 或根据需要的编码更改
        const $ = cheerio.load(html);
        let newDatas = []
        const datas = await getCustomData(customDataType, null, null, {
            Data15: dygangsUrl.Id
        })
        let count2 = 0;
        $('a[href^="magnet:?xt=urn:btih:"]').each((index, element) => {
            const link = element.attribs.href;
            const name = (element.children[0]?.data || '').toUpperCase();
            if (datas.filter(n => n.Data4 == link).length > 0) {
                count2++;
            } else {
                newDatas.push({
                    Type: customDataType,
                    Data1: videoName,
                    Data2: url,
                    Data3: name,
                    Data4: link,
                    Data15: dygangsUrl.Id
                })
                console.log(`${videoName}采集到新剧集：${name},${link}`)
            }
        });
        let downloadList = []
        if (newDatas.length > 0) {
            await addCustomData(newDatas)
            console.log(`【${videoName}】新采集数量：【${newDatas.length}】`)
            if (dygangsUrl.Data3 == "是") {
                const qBittorrentURL = process.env.qBittorrentURL
                if (!qBittorrentURL) {
                    console.log(`
未设置qBittorrent服务地址，请添加量子变量 ：
qBittorrentURL qb链接地址 如：http://192.168.98.8:9091
qbusername qb登录账号
qbpassword  qb登录密码`)
                } else {
                    const cookie = await qblogin();
                    for (let x = 0; x < newDatas.length; x++) {
                        const data = newDatas[x];
                        if (!isHighResolution(data.Data3)) {
                            console.log(`${videoName} 跳过下载不包含指定分辨率的项目：${data.Data3}`);
                            continue;
                        }
                        downloadList.push(data.Data4)
                        console.log("磁力下载提交结果----" + await addTorrents(cookie, data.Data4, videoName));
                    }
                    if (downloadList.length > 0) {
                        console.log(`【${videoName}】已自动提交【${downloadList.length}】条下载。`)
                    }
                }
            }
            if (dygangsUrl.Data5 == "是") {
                for (let x = 0; x < newDatas.length; x++) {
                    const data = newDatas[x];
                    if (!isHighResolution(data.Data3)) {
                        console.log(`${videoName} 跳过通知不包含指定分辨率的项目：${data.Data3}`);
                        continue;
                    }
                    const episodeInfo = extractEpisodeInfo(data.Data3);
                    await sendNotify(`${videoName} ${episodeInfo}`, true)
                }
            }
        }
        if (count2 > 0) {
            console.log(`【${videoName}】过往已采集数量：【${count2}】`)
        }
    }
})().catch((e) => {
    console.log("脚本异常：" + e);
});

async function init() {
    await addOrUpdateCustomDataTitle({
        Type: urlConfigDataType,
        TypeName: "影视监听配置",
        Title1: "影片名",
        Title2: "来源",
        Title3: "自动下载",
        Title4: "是否启用",
        Title5: "消息推送"
    });
    await addOrUpdateCustomDataTitle({
        Type: customDataType,
        TypeName: "影视监听记录",
        Title1: "影片名",
        Title2: "来源",
        Title3: "剧集标题",
        Title4: "磁力",
        // Title15: "影视监听配置Id" 不显示
    });
}