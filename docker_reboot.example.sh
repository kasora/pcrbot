sudo docker container stop qqbot-pcr
sudo docker run -ti --rm -d --name qqbot-pcr \
             -v $(pwd)/coolq:/home/user/coolq \
             -p 9000:9000 \
             -p 5700:5700 \
             -e CQHTTP_POST_URL=http://qq-bot.lan:9229 \
             -e CQHTTP_SERVE_DATA_FILES=yes \
             richardchien/cqhttp:latest
