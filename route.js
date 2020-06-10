exports = module.exports = {};

let service = require('./service');

exports.attack = {
  label: '出刀 例如 出刀 200000 也可以帮群员报刀 例如 出刀 @kasora 432000 ',
  alise: ['出刀', '报刀'],
  handler: service.attack,
};

exports.startTeamFight = {
  label: '[管理员限定] 工会战开始 开始一次公会战, 默认将在 8 天后结束',
  alise: ['工会战开始'],
  handler: service.startTeamFight,
};

exports.onTree = {
  label: '挂树 在当前 boss 被击杀时会在群里at所有挂树群员',
  alise: ['挂树', '我挂树了', '上树', '我上树了'],
  handler: service.onTree,
};

exports.who = {
  label: '查询昵称对应的本名 例如 谁是xcw',
  alise: ['谁是'],
  handler: service.who,
};

exports.inputBox = {
  label: '录入box 例如 录入box 5星黑骑 偶像5* 4*空花',
  alise: ['录入box', '导入box', '录入卡池', '导入卡池', '导入卡组', '录入卡组'],
  handler: service.inputBox,
};

exports.getBox = {
  label: '我的卡池',
  alise: ['我的卡池', '我的box', '我的卡组'],
  handler: service.getBox,
}

exports.help = {
  label: '帮助',
  alise: ['帮助', '指令', '指令列表', '指令表'],
  handler: service.help,
};

exports.codeMap = {};
Object.keys(exports).filter(key => key !== 'codeMap').forEach(key => {
  let handler = exports[key].handler;
  exports.codeMap[key] = handler;
  exports[key].alise.forEach(alise => exports.codeMap[alise] = handler);
});
