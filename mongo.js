'use strict';

const { MongoClient } = require('mongodb');

// 获取数据库相关的静态数据
const config = require('./config');

let _db = null;

/**
 * 连接到数据库，并将连接保存到 _db 中
 * 
 * @returns {Promise<MongoClient>} 生成 mongoClient 的 promise
 */
let mongoConnect = async () => {
  try {
    let { host, port, username, password, databaseName } = config.mongo;
    let linkUrl = `mongodb://${host}:${port}/`;
    /* istanbul ignore next */
    if (username && password) {
      linkUrl = `mongodb://${username}:${password}@${host}:${port}/${databaseName}`;
    }
    _db = (await MongoClient.connect(linkUrl, { useNewUrlParser: true, useUnifiedTopology: true })).db(databaseName);

    // 绑定快捷路径
    exports.User = _db.collection('user');
    exports.TempData = _db.collection('tempData');
    exports.Homework = _db.collection('homework');
    exports.attackQuery = _db.collection('attackQuery');
    exports.Damage = _db.collection('damage');

    return _db;
  } catch (err) {
    /* istanbul ignore next */
    console.error(err);
    /* istanbul ignore next */
    process.exit(10);
  }
};
let connection = mongoConnect();

/**
 * 一个 Promise
 * 数据库连接完成后会被 resolve
 *
 * @returns {Promise<Null>} 无意义
 */
let prepare = async () => {
  /* istanbul ignore else */
  if (!_db) await connection;
};

exports = module.exports = {
  get client() {
    return _db;
  },

  prepare: prepare,
};

/* Damage
type // admin: 管理设定血量 member: 成员下刀血量 tailAttack: 尾刀
date // 伤害时间
user_id
group_id
damage
point
*/

/* TempData
type // team_time: 工会战开始 team_onTree: 挂树
date
data
*/

/* Homework
date
timeline
boss: {
  number
  stage
  type // 普通 狂暴
}
roleList:[
  id
  star
]
name
maxDamage
minDamage
submittedBy
group_id
*/