import gulp from "gulp";
import cp from "child_process";
import gutil from "gulp-util";
import postcss from "gulp-postcss";
import cssImport from "postcss-import";
import cssnext from "postcss-cssnext";
import BrowserSync from "browser-sync";
import webpack from "webpack";
import webpackConfig from "./webpack.conf";
import svgstore from "gulp-svgstore";
import svgmin from "gulp-svgmin";
import inject from "gulp-inject";
import replace from "gulp-replace";
import imageop from 'gulp-image-optimization';
const imagemin = require('gulp-imagemin');
import cssnano from "cssnano";

const browserSync = BrowserSync.create();
const hugoBin = `./bin/hugo.${process.platform === "win32" ? "exe" : process.platform}`;
const defaultArgs = ["-d", "../dist", "-s", "site"];

gulp.task("hugo", (cb) => buildSite(cb));
gulp.task("hugo-preview", (cb) => buildSite(cb, ["--buildDrafts", "--buildFuture"]));
gulp.task("build", ["css", "fonts", "images", "js", "cms-assets", "hugo"]);
gulp.task("build-preview", ["css", "js", "images", "fonts", "cms-assets", "hugo-preview"]);

gulp.task("css", () => (
  gulp.src("./src/css/*.css")
    .pipe(postcss([
      cssImport({from: "./src/css/main.css"}),
      cssnext(),
      cssnano(),
    ]))
    .pipe(gulp.dest("./dist/css"))
    .pipe(browserSync.stream())
));


gulp.task('images', () =>
gulp.src('.src/static/img/home/*')
  .pipe(imagemin())
  .pipe(gulp.dest('.dist/images'))
);

gulp.task("fonts", () => (
  gulp.src("./src/fonts/*")
    .pipe(gulp.dest("./dist/fonts"))
));

gulp.task("cms-assets", () => (
  gulp.src("./node_modules/netlify-cms/dist/*.{woff,eot,woff2,ttf,svg,png}")
    .pipe(gulp.dest("./dist/css"))
));

gulp.task("js", (cb) => {
  const myConfig = Object.assign({}, webpackConfig);

  webpack(myConfig, (err, stats) => {
    if (err) throw new gutil.PluginError("webpack", err);
    gutil.log("[webpack]", stats.toString({
      colors: true,
      progress: true
    }));
    browserSync.reload();
    cb();
  });
});


gulp.task("svg", () => {
  const svgs = gulp
    .src("site/static/img/icons/*.svg")
    .pipe(svgmin())
    .pipe(svgstore({inlineSvg: true}));

  function fileContents(filePath, file) {
    return file.contents.toString();
  }

  return gulp
    .src("site/layouts/partials/svg.html")
    .pipe(inject(svgs, {transform: fileContents}))
    .pipe(gulp.dest("site/layouts/partials/"));
});

gulp.task("server", ["hugo", "css", "images","fonts", "cms-assets", "js", "svg"], () => {
  browserSync.init({
    server: {
      baseDir: "./dist"
    }
  });
  gulp.watch("./src/js/**/*.js", ["js"]);
  gulp.watch("./src/css/**/*.css", ["css"]);
  gulp.watch("./site/static/img/icons/*.svg", ["svg"]);
  gulp.watch("./site/**/*", ["hugo"]);
});

gulp.task("send-index-to-algolia", ["index-site"], function() {
  const index = JSON.parse(fs.readFileSync("./PagesIndex.json", "utf8"));
  return algoliaIndex.addObjects(index);
});

gulp.task("index-site", (cb) => {
  var pagesIndex = [];

  return gulp.src("dist/**/*.html")
    .pipe(reduce(function(memo, content, file, cb) {

      var section      = S(file.path).chompLeft(file.cwd + "/dist").between("/", "/").s,
        title        = S(content).between("<title>", "</title").collapseWhitespace().chompRight(" | Kaldi").s,
        pageContent  = S(content).stripTags().collapseWhitespace().s,
        href         = S(file.path).chompLeft(file.cwd + "/dist").s,
        pageInfo     = new Object(),
        isRestricted = false,
        blacklist    = [
          "/page/",
          "/tags/",
          "/tags/",
          "/pages/index.html",
          "/thanks",
          "404"
        ];

      // fixes homepage title
      if (href === "/index.html") {
        title = "Homepage";
      }

      // remove trailing 'index.html' from qualified paths
      if (href.indexOf("/index.html") !== -1) {
        href = S(href).strip("index.html").s;
      }

      // determine if this file is restricted
      for (const ignoredString of blacklist) {
        if (href.indexOf(ignoredString) !== -1) {
          isRestricted = true;
          break;
        }
      }

      // only push files that aren't ignored
      if (!isRestricted) {
        pageInfo["objectID"] = href;
        pageInfo["section"] = section;
        pageInfo["title"]   = title;
        pageInfo["href"]    = href;
        pageInfo["content"] = pageContent;

        pagesIndex.push(pageInfo);
      }

      cb(null, JSON.stringify(pagesIndex));
    }, "{}"))
    .pipe(rename("PagesIndex.json"))
    .pipe(gulp.dest("./"));
});

function buildSite(cb, options) {
  const args = options ? defaultArgs.concat(options) : defaultArgs;

  return cp.spawn(hugoBin, args, {stdio: "inherit"}).on("close", (code) => {
    if (code === 0) {
      browserSync.reload("notify:false");
      cb();
    } else {
      browserSync.notify("Hugo build failed :(");
      cb("Hugo build failed");
    }
  });

  
}
