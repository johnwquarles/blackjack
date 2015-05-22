#!/bin/sh

#install dependencies
npm install
bower install

#clean and prepare public directory
rm -rf public
cp -r src public

# compile jade to html
# Scott wrote this to handle copying/deletion of Jade's rendered files (it flattens the directories and renders each .jade file, even partials.
# So we can't use its 'watch' feature; have to use this more generic watch application, watch for changes in jade files, and each time, invoke what's in the quotes.
# (which simply calls jade and then handles copying/deletion)
./node_modules/.bin/nodemon -e jade --watch src --exec "
  ./node_modules/.bin/jade src -o public -PH
  rm -rf src/*.html public/_partials" &

# compile sass to css
./node_modules/.bin/node-sass src/_styles/main.scss public/css/main.css
./node_modules/.bin/node-sass \
 --source-comments \
 --output-style nested \
 --source-map-embed \
 --recursive \
 --watch \
 src/_styles/main.scss public/css/main.css &

# convert ES6 JS to ES5
./node_modules/.bin/babel \
  src \
  --out-dir public \
  -s inline \
  -w &

# concat bower_components to lib directory
if [ -d "bower_components" ]; then
  ./node_modules/.bin/bowcat -o public/lib
fi

echo "clean"
#clean unneeded files
rm -rf public/_styles \
       public/*.jade  \
       public/**/*.jade \
       public/*.scss \
       public/**/*.scss

echo "╔═══════════════════════════════════════════╗"
echo "║          Watching for changes...          ║"
echo "╚═══════════════════════════════════════════╝"
