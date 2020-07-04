# pcrbot
该项目旨在创建一个功能精简的 bot, 适用于小型工会使用.
会员录入轴后, 可以通过此 bot 自动计算出刀最优解

## 功能
- 报刀: 记录伤害, boss 被击杀时会通知所有挂树玩家
- 挂树: 挂树 在当前 boss 被击杀时会在群里at所有挂树群员
- 获取/修改boss状态: 获取/修改boss状态 ( 根据群员报刀 )
- 本日报告: 获取当日的战报
- 录入box: 录入你的卡池
- 我的box: 查看你的卡池
- 别名查询: 查看黑话对应的角色名 ( 感谢 [yobot](https://github.com/yuudi/yobot) 的数据 )
- 上传轴: 上传一份轴以供群员挑选
- 看轴: 根据轴名看轴的详情
- 计算攻略: 根据已录入的卡池计算出刀最优解, 默认使用当前 boss 状态, 也可传参筛选boss.
- 活动推送: 使用 [RssHub](https://github.com/DIYgod/RSSHub) 抓取 bilibili 动态进行活动推送

tips: 如果文档不匹配请使用 `help` 指令查看所有支持的指令

## 搭建
- 搭建 coolq-http-api 的环境。推荐使用 Docker。参照[这里](https://cqhttp.cc/docs/4.10/#/Docker)
- 根据你在 Docker 中传入的参数，对应的修改 `config.example.js`，并将其改名为 `config.js`
- 安装 MongoDB，请自行查询安装方式。并将 MongoDB 的参数给入 `config.js`
- `npm install`
- `npm start`
- 将你的 bot 拉入群，输入 `help` 查看是否正常运行

tips: 
- `coolq` 可以参照 `docker_reboot.example.sh` 进行 docker 搭建
- 可以使用 [pm2](https://github.com/Unitech/pm2) 来使 bot 后台运行. 参考脚本: `npm i pm2 -g && pm2 start npm --name "pcr" --time -- start`

## 开源协议
LGPL-3.0