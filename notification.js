exports = module.exports = {};

let mongo = require('./mongo');
let config = require('./config');
let utils = require('./utils');
let agent = require('superagent');
let xmlParser = require('xml-js')
let _ = require('lodash');

const sendNews = async () => {
  let ignoreRegExpList = config.notification.ignoreRegExpList;

  let rssRes;
  try {
    rssRes = await agent.get(`${config.notification.rssHubUrl}/bilibili/user/dynamic/353840826`)
  } catch (err) {
    // rss 获取失败, 等下次再获取
    return;
  }

  // 过期1天的新闻就没有价值了
  let beforeRoundTime = new Date();
  beforeRoundTime.setDate(beforeRoundTime.getDate() - 1);

  // rss 处理
  let opt = xmlParser.xml2js(rssRes.body.toString());
  let fullNewsList = opt.elements[0].elements[0].elements
    .filter(el => el.name === 'item')
    .map(el => ({
      message: el.elements.find(n => n.name === 'description').elements[0].cdata.split('<br>')[0],
      id: el.elements.find(n => n.name === 'guid').elements[0].text,
      date: new Date(el.elements.find(n => n.name === 'pubDate').elements[0].text),
    }));
  let archiveList = await mongo.TempData.find({
    type: 'news',
    "data.id": { $in: fullNewsList.map(news => news.id) },
  }).toArray();

  // 同步推送到镜像
  let archiveDiff = _.differenceBy(fullNewsList, archiveList.map(archive => archive.data), el => el.id);
  if (!archiveDiff.length) return;
  await mongo.TempData.insertMany(archiveDiff.map(messageBody => ({ type: 'news', data: messageBody, date: messageBody.date })));

  // 筛选消息
  let newsList = fullNewsList
    .filter(el => el.date > beforeRoundTime)
    .filter(m => !ignoreRegExpList.reduce((pre, cur) => pre || m.message.match(cur), false));
  let unsendMessageList = _.differenceBy(newsList, archiveList.map(archive => archive.data), el => el.id);
  if (!unsendMessageList.length) return;

  // 发送推送
  let groupList = await mongo.Group.find({ needNotification: true }).toArray();
  for (let messageBody of unsendMessageList) {
    await Promise.all(groupList.map(group => utils.sendMessage({ group_id: group.group_id, message: messageBody.message })));
  }
};
exports.sendNews = sendNews;
