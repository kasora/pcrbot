exports = module.exports = {};

//#region 类型定义

/**
 * @typedef {Object} BossInfo
 * @property {Number} stage boss 阶段
 * @property {String} type boss 状态
 * @property {Number} round boss 轮数
 * @property {Number} number boss 编号
 * @property {Number} hp boss 剩余血量
 */

/**
 * @typedef {Object} BossData
 * @property {Number} round boss 轮数
 * @property {Number} number boss 编号
 * @property {Number} hp boss 剩余血量
 */

/**
 * @typedef {Object} Role
 * @property {Array<String>} nicknames 别名数组
 * @property {String} mainName 角色名
 * @property {String} jpName 日文名
 * @property {String} id 角色 id
 */

//#endregion

let mongo = require('./mongo');
let config = require('./config');
let data = require('./data.json');
let roleData = require('./role');
let agent = require('superagent');
let _ = require('lodash');

const getCommand = (text) => {
  let command = text.split(' ');
  command.shift();

  return command.join(' ');
}
exports.getCommand = getCommand;

//#region coolq http api

const sendMessage = async (messageBody) => {
  let MAXLENGTH = 500;
  let message = messageBody.message;
  let messageList = message.split('\n');
  let pictureRegex = /\[CQ:image.*?\]/g;

  let tempMessageList = [];
  let tempMessage = '';

  for (let messageLine of messageList) {
    tempMessage = messageLine;
    while (tempMessage.search(pictureRegex) !== -1) {
      let pictureIndex = tempMessage.search(pictureRegex);
      let pictureLength = tempMessage.match(pictureRegex)[0].length;
      tempMessageList.push(tempMessage.slice(0, pictureIndex));
      tempMessageList.push(tempMessage.slice(pictureIndex, pictureIndex + pictureLength));
      tempMessage = tempMessage.slice(pictureIndex + pictureLength);
    }
    tempMessageList.push(tempMessage);
  }

  messageList = tempMessageList;

  tempMessageList = [];
  tempMessage = '';
  let tempLength = 0;

  // 按行切割消息
  for (let messageLine of messageList) {
    // 图片直接填充
    if (messageLine.search(pictureRegex) !== -1) {
      tempMessage += messageLine;
      continue;
    }

    // 单行超长则切割该行
    if (messageLine.length > MAXLENGTH) {
      // 先前的缓存入队
      if (tempLength) tempMessageList.push(tempMessage);
      tempMessage = '';
      tempLength = 0;

      while (messageLine.length > MAXLENGTH) {
        let temp = messageLine.slice(0, MAXLENGTH);
        messageLine = messageLine.slice(MAXLENGTH);

        tempMessageList.push(temp);
      }
      if (messageLine.length) {
        tempMessage = messageLine;
        tempLength = tempMessage.length;
      }
    } else {
      if (tempLength + messageLine.length > MAXLENGTH) {
        tempMessageList.push(tempMessage);
        tempMessage = messageLine;
        tempLength = tempMessage.length;
      } else {
        tempMessage = [tempMessage, messageLine].filter(el => el).join('\n');
        tempLength += messageLine.length + 1;
      }
    }
  }
  if (tempMessage.length) tempMessageList.push(tempMessage);
  tempMessageList = tempMessageList.filter(el => el);

  // 分片发送消息
  for (let messageLine of tempMessageList) {
    let agentRes = await agent
      .post(`${config.coolq.host}:${config.coolq.port}/send_msg`)
      .send(Object.assign({}, messageBody, { message: messageLine }));
    if (agentRes.body.status !== 'ok') {
      console.error(`发送消息给 ${messageBody.user_id || messageBody.group_id} 失败. 消息片段为:\n ${messageLine}`)
      let newError = new Error();
      newError.resp = agentRes.body;
      newError.resp.user_id = messageBody.user_id;
      newError.resp.group_id = messageBody.group_id;
      throw newError;
    }
  }
}
exports.sendMessage = sendMessage;

const getGroupList = async () => {
  let agentRes = await agent.get(`${config.coolq.host}:${config.coolq.port}/get_group_list`);
  if (agentRes.body.status !== 'ok') {
    console.error(agentRes.body);
  }
  let groupList = await mongo.Group.find({ group_id: { $in: agentRes.body.data.map(el => el.group_id) } }).toArray();
  if (groupList.length !== agentRes.body.data.length) {
    let diffList = _.differenceBy(agentRes.body.data, groupList, el => el.group_id);
    diffList.forEach(el => el.needNotification = false);
    await mongo.Group.insertMany(diffList);
  }
  return agentRes.body.data;
}
exports.getGroupList = getGroupList;

const setGroupCard = async (groupId, userId, card) => {
  let agentRes = await agent
    .post(`${config.coolq.host}:${config.coolq.port}/set_group_card`)
    .send({
      group_id: groupId,
      user_id: userId,
      card: card,
    });
  if (agentRes.body.status !== 'ok') {
    console.error(agentRes.body);
  }
  return agentRes.body.data;
}
exports.setGroupCard = setGroupCard;

const getGroupUserList = async (groupId) => {
  let agentRes = await agent
    .get(`${config.coolq.host}:${config.coolq.port}/get_group_member_list`)
    .query({
      group_id: groupId,
    });
  if (agentRes.body.status !== 'ok') {
    console.error('获取群员列表失败.', agentRes.body);
  }
  agentRes.body.data = agentRes.body.data.filter(el => el.user_id !== config.botId);
  return agentRes.body.data;
}
exports.getGroupUserList = getGroupUserList;

const getGroupUserInfo = async (groupId, userId) => {
  let agentRes = await agent
    .get(`${config.coolq.host}:${config.coolq.port}/get_group_member_info`)
    .query({
      group_id: groupId,
      user_id: userId,
      no_cache: true,
    });
  if (agentRes.body.status !== 'ok') {
    console.error('获取群员信息失败.', agentRes.body);
    return null;
  }
  return agentRes.body.data;
}
exports.getGroupUserInfo = getGroupUserInfo;

const leaveGroup = async (groupId) => {
  con
  let agentRes = await agent.post(`${config.coolq.host}:${config.coolq.port}/set_group_leave`).send({
    group_id: groupId,
  });
  if (agentRes.body.status !== 'ok') {
    console.error(agentRes.body);
  }
}
exports.leaveGroup = leaveGroup;

//#endregion

//#region service utils

let findOrCreateGroupUser = async (groupId, userId) => {
  let userInfo = await mongo.User.findOne({
    group_id: groupId,
    user_id: userId,
  });
  if (!userInfo) {
    let tempInfo = await getGroupUserInfo(groupId, userId);
    tempInfo.isAdmin = tempInfo.role === 'admin' || tempInfo.role === 'owner';
    tempInfo.isTeamMember = false;
    await mongo.User.insertOne(tempInfo);
    return findOrCreateGroupUser(groupId, userId);
  }
  return userInfo;
}
exports.findOrCreateGroupUser = findOrCreateGroupUser;

let setGroupAdmin = async (groupId, userId, status) => {
  await findOrCreateGroupUser(groupId, userId);
  await mongo.User.updateOne(
    { group_id: groupId, user_id: userId },
    { $set: { isAdmin: status } }
  )
}
exports.setGroupAdmin = setGroupAdmin;

let syncGroupAdmin = async () => {
  let groupList = await getGroupList();
  for (let group of groupList) {
    let groupUserList = await getGroupUserList(group.group_id);
    for (let groupUser of groupUserList) {
      await setGroupAdmin(group.group_id, groupUser.user_id, groupUser.role === 'admin' || groupUser.role === 'owner');
    }
  }
}
exports.syncGroupAdmin = syncGroupAdmin;

let isAdmin = async (groupId, userId) => {
  if (config.adminIdList.includes(userId)) return true;
  let userInfo = await mongo.User.findOne({ group_id: groupId, user_id: userId });
  return !!userInfo.isAdmin;
}
exports.isAdmin = isAdmin;

let getTeamFightTime = async (groupId) => {
  let teamTime = await mongo.TempData.find({
    type: 'team_time',
    "data.group_id": groupId,
  }).sort({ date: -1 }).limit(1).toArray();
  if (!teamTime.length) throw new Error('工会战尚未开始.');

  let startTime = teamTime[0].date;
  let endTime = new Date(startTime);
  endTime.setDate(endTime.getDate() + 8);

  return { startTime, endTime };
}
exports.getTeamFightTime = getTeamFightTime;

let getBossNumber = (hpList, damage) => {
  let hpSum = _.sum(hpList);
  if (damage >= hpSum) throw new Error('伤害溢出');
  let number = 0;
  while (damage >= 0) {
    damage -= hpList[number++];
  }

  return {
    number: number,
    hp: -damage || 0,
  }
}

let getGroupDamage = async (groupId) => {
  let { startTime, endTime } = await getTeamFightTime(groupId);

  let damageList = await mongo.Damage.find({
    date: {
      $gte: startTime,
      $lte: endTime,
    },
    group_id: groupId,
  }).sort({ date: 1 }).toArray();

  let sumDamage = 0;
  let damageObject;
  while (damageObject = damageList.pop()) {
    sumDamage += damageObject.damage;
    if (damageObject.type === 'admin') break;
  };

  return sumDamage;
}

/**
 * 获取指定群的 boss 状态
 * 
 * @param {Number} groupId 群号
 * @returns {Promise<BossInfo>} boss 状态
 */
let getBoss = async (groupId) => {
  let sumDamage = await getGroupDamage(groupId);
  let lastRoundSum = _.sum(data.boss[data.boss.length - 1]);

  let opt = {};

  let dataSum = _.sum(data.boss.map(roundData => _.sum(roundData)));
  if (sumDamage >= dataSum) {
    opt.round = Math.floor((sumDamage - dataSum) / lastRoundSum) + data.boss.length + 1;
    Object.assign(opt, getBossNumber(
      data.boss[data.boss.length - 1],
      sumDamage - dataSum - (opt.round - 1 - data.boss.length) * lastRoundSum
    ))
  } else {
    opt.round = 1;
    while (1) {
      let nowRoundSum = _.sum(data.boss[opt.round - 1]);
      if (sumDamage >= nowRoundSum) sumDamage -= nowRoundSum;
      else {
        Object.assign(opt, getBossNumber(data.boss[opt.round - 1], sumDamage));
        break;
      }
      opt.round++;
    }
  }

  let bossHp = data.boss[opt.round >= data.boss.length ? data.boss.length - 1 : opt.round - 1][opt.number - 1];

  opt.stage = opt.round / data.stage.step > data.stage.maxStage ? data.stage.maxStage : Math.floor(opt.round / data.stage.step);
  opt.type = opt.round < data.stage.angryBossMinRound
    || !data.stage.angryBossList.includes(opt.number)
    || opt.hp > Math.floor(bossHp * data.stage.angryPercent / 100)
    ? '普通' : '狂暴';

  return opt;
}
exports.getBoss = getBoss;

/**
 * 计算传入的字符串中描述的
 * 
 * @param {Number} groupId 群号
 * @returns {Promise<BossInfo>} boss 状态
 */
let getBossByMessage = async (bossMessage) => {
  let bossInfo = {};
  let stageAlpha = ['index_fix', 'a', 'b', 'c', 'd'];

  bossMessage = replaceChinese(bossMessage.toLowerCase().replace(' ', ''));

  let temp = bossMessage.match(/([1-9]{1})阶段/);
  if (temp) bossInfo.stage = Number(temp[1]);
  temp = bossMessage.match(/([abcd]{1})面/);
  if (temp) bossInfo.stage = stageAlpha.findIndex(el => el === temp[1]);
  temp = bossMessage.match(/([abcd]{1})([1-5]{1})/);
  if (temp) {
    bossInfo.stage = stageAlpha.findIndex(el => el === temp[1]);
    bossInfo.number = Number(temp[2]);
  }
  temp = bossMessage.match(/([1-5]{1})王/);
  if (temp) bossInfo.number = Number(temp[1]);
  temp = bossMessage.match(/([1-5]{1})号/);
  if (temp) bossInfo.number = Number(temp[1]);
  temp = bossMessage.match(/狂暴/);
  bossInfo.type = temp ? '狂暴' : '普通';

  temp = bossMessage.match(/(?<![a-zA-Z])([0-9]{4,})(?![(王|号|boss|阶段|面)])/);
  if (temp) bossInfo.hp = Number(temp[1]);

  return bossInfo;
}
exports.getBossByMessage = getBossByMessage;

/**
 * 获取指定 boss 状态需要伤害总额
 * 
 * @param {Number} round 轮数
 * @param {Number} number 编号
 * @param {Number} hp 剩余血量
 * @returns {Number}
 */
let getBossDamage = (round, number, hp) => {
  let sumDamage = 0;
  let dataSum = _.sum(data.boss.map(roundData => _.sum(roundData)));
  let lastRoundData = data.boss[data.boss.length - 1];
  let lastRoundSum = _.sum(lastRoundData);
  if (round > data.boss.length) {
    let lastRound = round - 1 - data.boss.length;
    sumDamage = dataSum + lastRoundSum * lastRound;
    sumDamage += _.sum(lastRoundData.slice(0, number - 1))
    sumDamage += lastRoundData[number - 1] - hp;
    return sumDamage;
  }

  sumDamage += _.sum(data.boss.slice(0, round - 1).map(_.sum));
  sumDamage += _.sum(lastRoundData.slice(0, number - 1))
  sumDamage += data.boss[round - 1][number - 1] - hp;
  return sumDamage;
}

/**
 * 设置指定群的boss状态
 * 
 * @param {Number} groupId 群号
 * @param {Number} round 轮数
 * @param {Number} number boss 编号
 * @param {Number} hp 剩余血量
 * @returns
 */
let setBoss = async (groupId, round, number, hp) => {
  let damage = getBossDamage(round, number, hp);
  if (isNaN(damage) || damage < 0) throw new Error('超出 boss 血量范围');

  return await mongo.Damage.insertOne({
    type: 'admin',
    date: new Date(),
    group_id: groupId,
    damage,
    point: 0,
  });
}
exports.setBoss = setBoss;

let checkTree = async (groupId) => {
  let bossInfo = await getBoss(groupId);
  let { startTime, endTime } = await getTeamFightTime(groupId);

  let tree = await mongo.TempData.find({
    type: 'team_onTree',
    date: { $gte: startTime, $lte: endTime },
    "data.group_id": groupId,
  }).toArray();

  let treeMember = [];
  for (let treeData of tree) {
    if (treeData.data.number !== bossInfo.number || treeData.data.round !== bossInfo.round) {
      treeMember.push(treeData.data.user_id);
    }
  };

  await mongo.TempData.deleteMany({
    type: 'team_onTree',
    date: { $gte: startTime, $lte: endTime },
    "data.group_id": groupId,
  });
  treeMember = Array.from(new Set(treeMember));
  if (treeMember.length) {
    await sendMessage({
      message_type: 'group',
      message: `${treeMember.map(user => `[CQ:at,qq=${user}]`).join(' ')} boss已死. 可以下树了.`,
      group_id: groupId,
    })
  }
}
exports.checkTree = checkTree;

let checkAttack = async (groupId, userId) => {
  let startToday = new Date()
  if (startToday.getHours() < 5) startToday.setDate(startToday.getDate() - 1);
  startToday.setHours(5);
  startToday.setMinutes(0);
  startToday.setSeconds(0);
  startToday.setMilliseconds(0);
  let endToday = new Date(startToday);
  endToday.setDate(endToday.getDate() + 1);

  let query = {
    group_id: groupId,
    type: { $ne: 'admin' },
    date: {
      $gte: startToday,
      $lte: endToday,
    },
  };
  if (userId) query.userId = userId;
  let damageList = await mongo.Damage.find(query).toArray();

  return damageList;
}
exports.checkAttack = checkAttack;

/**
 * 根据别名获取角色信息
 * 
 * @param {String} nickname 角色别名
 * @returns {Role} 角色信息
 */
let whoIs = (nickname) => {
  nickname = nickname.trim();
  let role = roleData.find(role => role.nicknames.map(el => el.toLowerCase()).includes(nickname.toLowerCase()));
  if (!role) return;
  return _.cloneDeep(role);
}
exports.whoIs = whoIs;

let getRoleByRoleIdList = (roleIdList) => {
  return roleIdList.map(id => {
    let role = roleData.find(role => role.id === id);
    if (!role) throw new Error('roleId 不存在');
    return _.cloneDeep(role);
  });
}
exports.getRoleByRoleIdList = getRoleByRoleIdList;

let getRoleListByRoleMessage = (message) => {
  let roleMessageList = message.split(' ').filter(el => el);

  let errorList = [];
  let roleList = [];
  for (let roleMessage of roleMessageList) {
    roleMessage = roleMessage.replace(/(.{1})[\*星]/, (r, $1) => replaceChinese($1) + '星');
    let star = roleMessage.match(/(.{1})[\*星]/);
    if (!star) { errorList.push({ data: roleMessage, reason: '星级数据有误' }); continue; }
    star = Math.floor(Number(star[1]));
    if (isNaN(star) || star < 0) { errorList.push({ data: roleMessage, reason: '星级数据有误' }); continue; }

    let role = roleMessage.match(/[0-9]+[\*星](.+)/);
    if (!role) role = roleMessage.match(/(.+)[0-9]+[\*星]/);
    if (!role) { errorList.push({ data: roleMessage, reason: '没有录入角色' }); continue; }
    role = role[1];
    role = whoIs(role);
    if (!role) { errorList.push({ data: roleMessage, reason: '找不到这个角色' }); continue; }
    role.star = star;
    roleList.push(role);
  }

  if (errorList.length) throw new Error(errorList.map(error => error.data + ' ' + error.reason).join('\n'));
  return roleList;
}
exports.getRoleListByRoleMessage = getRoleListByRoleMessage;

let getBoxMaxDamage = (homeworkList, roleBox, teamNumber) => {
  let damageOutput = { maxDamage: 0, minDamage: 0, avarageDamage: 0, teamList: [], homeworkList: [] };
  if (teamNumber === 0) return damageOutput;

  let checkRoleExist = (role, userBox) => {
    let userRole = userBox.find(boxRole => boxRole.id === role.id);
    return userRole && userRole.star >= role.star;
  }

  let updateMaxDamage = (homework, damageObject, borrowRole) => {
    if (damageObject.avarageDamage + Math.floor((homework.maxDamage + homework.minDamage) / 2) > damageOutput.avarageDamage) {
      damageOutput = {
        maxDamage: damageObject.maxDamage + homework.maxDamage,
        minDamage: damageObject.minDamage + homework.minDamage,
        avarageDamage: damageObject.avarageDamage + Math.floor((homework.maxDamage + homework.minDamage) / 2),
        teamList: damageObject.teamList.concat([
          _.cloneDeep(homework.roleList).map(role => { if (role.id === borrowRole.id) role.isBorrow = true; return role })
        ]),
        homeworkList: damageObject.homeworkList.concat([homework]),
      }
    }
  }

  // 检查是否还有能抄的作业
  let tempHomeworkList = homeworkList.filter(homework => {
    let tempList = homework.roleList.filter(role => checkRoleExist(role, roleBox));
    return tempList.length >= 4;
  });
  if (!tempHomeworkList.length) return damageOutput;

  for (let i = 0; i < tempHomeworkList.length; i++) {
    let currectHomework = tempHomeworkList[i];
    let lastHomeworkList = tempHomeworkList.filter(homework => homework._id !== currectHomework._id);
    let borrowRole = currectHomework.roleList.find(role => !checkRoleExist(role, roleBox));
    if (borrowRole) {
      let lastRoleBox = roleBox.filter(role => !currectHomework.roleList.map(role => role.id).includes(role.id));
      let thisDamageObject = getBoxMaxDamage(lastHomeworkList, lastRoleBox, teamNumber - 1);
      updateMaxDamage(currectHomework, thisDamageObject, borrowRole);
    }
    for (borrowRole of currectHomework.roleList) {
      let lastRoleBox = roleBox.filter(role => !currectHomework.roleList.map(role => role.id).includes(role.id));
      lastRoleBox.push(borrowRole);
      let thisDamageObject = getBoxMaxDamage(lastHomeworkList, lastRoleBox, teamNumber - 1);
      updateMaxDamage(currectHomework, thisDamageObject, borrowRole);
    }
  }

  return damageOutput;
}
exports.getBoxMaxDamage = getBoxMaxDamage;

//#endregion

//#region utils

const strPossible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const haxPossible = 'abcdef0123456789';

/**
 * 构建一个随机字符串
 *
 * @param {Number} length 字符串长度
 */
function createRandomString(length = 10, flag = {}) {
  let possible = strPossible;
  if (flag.hax) possible = haxPossible;
  return Array(length).fill(0).map(i => possible.charAt(Math.floor(possible.length * Math.random()))).join('');
}
exports.createRandomString = createRandomString;

function sleep(millisecond) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, millisecond);
  })
}
exports.sleep = sleep;

/**
 * 替换中文字符到数字
 * 
 * @param {String} message 
 * @returns {String}
 */
function replaceChinese(message) {
  message = message.replace(/一/g, '1');
  message = message.replace(/二/g, '2');
  message = message.replace(/两/g, '2');
  message = message.replace(/三/g, '3');
  message = message.replace(/四/g, '4');
  message = message.replace(/五/g, '5');
  message = message.replace(/六/g, '6');
  message = message.replace(/七/g, '7');
  message = message.replace(/八/g, '8');
  message = message.replace(/九/g, '9');
  message = message.replace(/十/g, '10');
  message = message.replace(/([0-9]+)[\.]{0,1}([0-9]*)[kK]/g, (r, $1, $2) => $1 + $2.padEnd(3, '0'));
  message = message.replace(/([0-9]+)[\.]{0,1}([0-9]*)[wW]/g, (r, $1, $2) => $1 + $2.padEnd(4, '0'));
  message = message.replace(/([0-9]+)[\.]{0,1}([0-9]*)[mM]/g, (r, $1, $2) => $1 + $2.padEnd(6, '0'));

  return message;
}
exports.replaceChinese = replaceChinese;

//#endregion
