exports = module.exports = {};

let service = require('./service');
let utils = require('./utils');

exports.attack = {
  label: '出刀, 也可以替别人出刀, boss 被击杀时会通知所有挂树玩家',
  example: [
    '出刀 200000',
    '出刀 @kasora 432000',
  ],
  alise: ['出刀', '报刀'],
  handler: service.attack,
};

exports.deleteAttack = {
  label: '撤销出刀, 管理员可以撤销别人的出刀',
  example: [
    '撤销出刀',
    '撤销出刀 @kasora'
  ],
  alise: ['撤销出刀', '撤回出刀', '取消出刀'],
  handler: service.deleteAttack,
};

exports.startTeamFight = {
  label: '[管理员限定] 开始一次公会战, 默认将在 8 天后结束',
  example: [
    '工会战开始',
  ],
  alise: ['工会战开始', '开始工会战', '公会战开始', '开始公会战'],
  admin: true,
  handler: service.startTeamFight,
};

exports.exitTeam = {
  label: '退出公会',
  example: [
    '退出公会',
  ],
  alise: ['退出公会'],
  handler: service.exitTeam,
};

exports.dailyReport = {
  label: '[管理员限定] 获取当日的战报',
  alise: ['今日战报', '今日报告'],
  admin: true,
  handler: service.dailyReport,
}

exports.onTree = {
  label: '挂树 在当前 boss 被击杀时会在群里at所有挂树群员',
  example: [
    '我挂树了',
  ],
  alise: ['挂树', '我挂树了', '上树', '我上树了'],
  handler: service.onTree,
};

exports.who = {
  label: '查询昵称对应的本名',
  example: [
    '谁是xcw',
  ],
  alise: ['谁是'],
  handler: service.who,
};

exports.inputBox = {
  label: '录入你的卡池',
  example: [
    '录入box 5星黑骑 偶像5* 4*空花',
  ],
  alise: ['录入box', '导入box', '录入卡池', '导入卡池', '导入卡组', '录入卡组'],
  handler: service.inputBox,
};

exports.getBoss = {
  label: '获取 Boss 当前状态',
  example: [
    '查看boss',
  ],
  alise: ['查看boss', '查看boss状态', '获取boss', '获取boss状态'],
  handler: service.getBoss,
}

exports.setBoss = {
  label: '设定 boss 状态',
  example: [
    '设定boss 3周目5王 血量40',
  ],
  alise: ['设定boss', '修改boss状态', '修改boss', '设定boss状态', '设置boss', '设置boss状态'],
  handler: service.setBoss,
}

exports.getBox = {
  label: '获取自己已录入卡池',
  example: [
    '我的box',
  ],
  alise: ['我的卡池', '我的box', '我的卡组'],
  handler: service.getBox,
}

exports.addHomework = {
  label: '上传一份轴以供所有使用本bot的群挑选',
  example: [
    '格式为: 上传轴 轴名称 boss阶段 预估伤害区间\n所需阵容\n轴详情(直接贴链接也ok)',
    '例如:',
    '上传轴 B2黄骑轴 狂暴B5 32w-34w\n3星狼 4星狗 3星黄骑 4星黑骑 3星深月\n1.09狼ub',
    '如果该轴不想被其他群的工会看见, 指令稍作修改, 例如: ',
    '上传轴 私有 B2黄骑轴 狂暴B5 32w-34w\n3星狼 4星狗 3星黄骑 4星黑骑 3星深月\n1.09狼ub',
  ],
  alise: ['上传轴', '上传作业', '导入轴', '录入轴'],
  handler: service.addHomework,
}

exports.addFightHistory = {
  label: '录入pvp的结果, 胜利队伍在前',
  example: [
    `录入战绩 星法 臭鼬 毛二力 兔剑 偶像 星法 猫剑 偶像 抖M 布丁\n毛二力 狼 偶像 狗 黑骑 星法 猫剑 偶像 抖M 布丁\n星法 猫剑 偶像 抖M 布丁 xcw 星法 中二 猫剑 偶像\n姐姐 猫剑 偶像 抖M 布丁 姐姐 狼 狗 黑骑 布丁`,
  ],
  alise: ['录入战斗', '录入战绩'],
  handler: service.addFightHistory,
}

// exports.beatTeam = {
//   label: '根据你的box查找指定敌方队伍的最优解法',
//   example: [
//     '',
//   ],
//   alise: ['录入战斗', '录入战绩'],
//   handler: service.addFightHistory,
// }

exports.getHomework = {
  label: '根据轴名看轴的详情',
  example: [
    '看轴 12刀哥暴打半血狂暴bishi',
  ],
  alise: ['看轴', '查看轴', '看轴详情', '作业详情'],
  handler: service.getHomework,
}

exports.getMaxDamage = {
  label: '根据已录入的卡池计算出刀最优解, 默认使用当前阶阶段, 也可传参筛选boss.',
  example: [
    '计算攻略 2刀 二周目狂暴5王',
  ],
  alise: ['计算攻略', '抄作业', '有作业吗', '来个轴'],
  handler: service.getMaxDamage,
}

exports.switchNotification = {
  label: '[管理员限定] 开启/关闭新闻推送',
  example: [
    '开启新闻推送',
  ],
  alise: ['开启新闻推送', '关闭新闻推送', '开启活动推送', '关闭活动推送'],
  admin: true,
  handler: service.switchNotification,
}

exports.help = {
  label: '帮助 可传参查询对应的指令详情',
  example: [
    'help 我的box',
  ],
  alise: ['帮助', '指令', '指令列表', '指令表'],
  handler: service.help,
};

exports.codeMap = {};
let repeatRouteNameList = [];
Object.keys(exports).filter(key => key !== 'codeMap').forEach(key => {
  let handler = exports[key].handler;

  // 管理员限定接口预处理
  if (exports[key].admin) {
    handler = async (message, sender) => {
      if (!await utils.isAdmin(sender.group_id, sender.user_id)) return;
      return exports[key].handler(message, sender);
    }
  }

  exports.codeMap[key] = handler;
  exports[key].alise.forEach(alise => {
    if (exports.codeMap[alise]) {
      repeatRouteNameList.push(alise);
    }
    exports.codeMap[alise] = handler;
  });
});
if (repeatRouteNameList.length) {
  console.error('以下指令的别名冲突:\n' + Array.from(new Set(repeatRouteNameList)).join('\n'))
  process.exit();
}
