#!/usr/bin/env bash

# cat \
# 	node_modules/lz-string/libs/lz-string.min.js \
# 	node_modules/lz-string/libs/base64-string.js \
# 	> build/libs.js
cp node_modules/lz-string/libs/lz-string.min.js build/libs.js

awk '{print $0}' src/*.js > build/temp.js

cat \
	build/libs.js \
	build/temp.js \
	> build/player.js

rm build/temp.js

./node_modules/uglify-es/bin/uglifyjs build/player.js \
	--compress --screw-ie8 --mangle toplevel -c --beautify --mangle-props regex='/^_/;' \
	-o build/player.min.beauty.js
	
./node_modules/uglify-es/bin/uglifyjs build/player.js \
	--compress --screw-ie8 --mangle toplevel --mangle-props regex='/^_/;' \
	-o build/player.min.js

cat \
	src/minireset.css \
	src/styles.css \
	> build/player.css

./node_modules/.bin/uglifycss build/player.css > build/player.min.css
sed -e "/\/\*__PLAYER_STYLES__\*\//{r build/player.min.css" -e "d}" src/player-template.html > build/temp.html

sed -e "/__PLAYER_SOURCE__/{r build/player.js" -e "d}" build/temp.html > build/player.dev.html
sed -e "/__PLAYER_SOURCE__/{r build/player.min.js" -e "d}" build/temp.html > build/player.html
sed -e "/__PLAYER_SOURCE__/{r build/player.min.beauty.js" -e "d}" build/temp.html > build/player.beauty.html

rm build/temp.html