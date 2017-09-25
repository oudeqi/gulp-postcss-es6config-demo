import gulp from 'gulp';
import gulpLoadPlugins from 'gulp-load-plugins';
import browserSync from 'browser-sync';
import minifyCss from 'gulp-clean-css';
import pngquant from 'imagemin-pngquant'; //png图片压缩插件
import spritesmith from 'gulp.spritesmith';
import buffer from 'vinyl-buffer';
import merge from 'merge-stream';
import fileinclude from 'gulp-file-include';
import revReplace from 'gulp-rev-replace';
import runSequence from 'run-sequence';
import processors from './postcss.config.js';

const $ = gulpLoadPlugins();

gulp.task('clean', ()=> {
	return gulp.src(['dist/', 'build/'])
		.pipe($.clean());
});

gulp.task('scripts', ()=> {
    return gulp.src('app/scripts/*.js')
        .pipe($.plumber())
        .pipe($.sourcemaps.init())
        .pipe($.babel())
        .pipe($.sourcemaps.write('.'))
        .pipe(gulp.dest('dist/scripts/'));
});

gulp.task('styles', ()=> {
	return gulp.src('app/styles/*.css')
		.pipe($.plumber())
		.pipe($.sourcemaps.init())
		.pipe($.postcss(processors))
		// .pipe(minifyCss())
		.pipe($.sourcemaps.write('.'))
		.pipe(gulp.dest('dist/styles/'));
});

gulp.task('images', ()=> {
	return gulp.src('app/images/*.*')
		.pipe(gulp.dest ('dist/images/'));
});

gulp.task('html', ()=> {
    return gulp.src('app/*.html')
        .pipe(fileinclude({
			prefix: '@@',
			basepath: '@file',
			context: {
				hasFooter: true,
				arr: ['test1', 'test2']
			}
		}))
        .pipe(gulp.dest('dist/'));
});

gulp.task('icons', ()=> {
	let spriteData = gulp.src(['app/icons/*.png','!app/icons/*@3x.png'])
	.pipe(spritesmith({
		imgName: 'sprite.png',
    	imgPath: "../images/sprite.png",
		cssName: 'sprite.css',
		cssFormat: 'css',
    	padding: 20,
    	cssTemplate: './handlebarsStr.css.handlebars'
	}));
	let imgStream = spriteData.img
	.pipe(gulp.dest('dist/images/'));
	let cssStream = spriteData.css
	.pipe($.postcss([require('postcss-calc')]))
	.pipe(gulp.dest('dist/styles/'));
	return merge(imgStream, cssStream);
});

gulp.task('server', ['html', 'styles', 'scripts', 'icons', 'images'], ()=> {
    browserSync({
        notify : false,
        port:3000,
        server:{
            baseDir:['dist/', 'node_modules/'], //确定根目录,可以指定多个
        }
    });
    gulp.watch(['app/*.html'], ['html']).on('change', browserSync.reload);
    gulp.watch(['app/styles/*.css'], ['styles']).on('change', browserSync.reload);
    gulp.watch(['app/scripts/*.js'], ['scripts']).on('change', browserSync.reload);
    gulp.watch(['app/icons/*.*'], ['icons']).on('change', browserSync.reload);
    gulp.watch(['app/images/*.*'], ['images']).on('change', browserSync.reload);
});

gulp.task('default', ['clean'], ()=> {
    gulp.start('server');
});

// ----------------------------------------------------- build

gulp.task('build:clean', ()=> {
    return gulp.src('build/', {read: false})
    .pipe($.clean());
});

gulp.task('build:images', ()=> {
	return gulp.src('dist/images/*.*')
	.pipe($.cache($.imagemin({
				optimizationLevel: 3,
				progressive: true, 
				interlaced: true,
				use: [pngquant()]
			})
		))
	.pipe(gulp.dest('build/images/'));
});

gulp.task('build:styles', ()=> {
	return gulp.src('dist/styles/*.css')
	.pipe(minifyCss())
	.pipe(gulp.dest('build/styles/'));
});

gulp.task('build:scripts', ()=> {
	return gulp.src('dist/scripts/*.js')
	.pipe($.uglify().on('error', function(e){
		console.log(e);
	}))
	.pipe(gulp.dest('build/scripts/'));
});

gulp.task('useref', ['build:styles', 'build:scripts'], ()=> {
    let options = {
        removeComments: false,//清除HTML注释
        collapseWhitespace: true,//压缩HTML
        collapseBooleanAttributes: false,//省略布尔属性的值 <input checked="true"/> ==> <input />
        removeEmptyAttributes: false,//删除所有空格作属性值 <input id="" /> ==> <input />
        removeScriptTypeAttributes: false,//删除<script>的type="text/javascript"
        removeStyleLinkTypeAttributes: false,//删除<style>和<link>的type="text/css"
        minifyJS: false,//压缩页面里的JS
        minifyCSS: false//压缩页面里的CSS
    };
    return gulp.src('dist/*.html')
        .pipe($.plumber())
        .pipe($.useref({searchPath: ['app/', 'node_modules/']}))
        .pipe($.if('*.js', $.uglify()))
        .pipe($.if('*.css', minifyCss()))
        .pipe($.if('*.html', $.htmlmin(options)))
        .pipe(gulp.dest('build/'));
});

gulp.task('rev', ['useref'], ()=> {
    return gulp.src([
    	'build/styles/*.css', 
    	'build/scripts/*.js', 
    	'build/images/*.*',
    	'build/common/*.*'
    ], {base: 'build/'})
    .pipe($.rev())
    .pipe(gulp.dest('build/'))
    .pipe($.rev.manifest({
        merge: true
    }))
    .pipe(gulp.dest('build/'));
});

gulp.task('replacerev', ['rev'], ()=> {
  var manifest = gulp.src('build/rev-manifest.json');
  return gulp.src([
  		'build/*.html',
  		'build/styles/*.css', 
  		'build/scripts/*.js', 
  		'build/common/*.*'
  	], {base: 'build'})
    .pipe(revReplace({manifest: manifest}))
    .pipe(gulp.dest('build/'));
});

gulp.task('size', ()=>{
    return gulp.src('build/**/*')
    	.pipe($.size({title:'build', gzip:true}));
});

gulp.task('build', ['build:clean'], ()=> {
	browserSync({
         server: 'build/'
    });
	return runSequence('build:images', 'replacerev', 'size');
});

// ----------------------------------------------------- 备用
gulp.task('concat', ()=> {
    gulp.src('src/scripts/*.js')
    .pipe(concat('all.js'))
    .pipe(gulp.dest('dest/scripts/'));
});
gulp.task("browserify", ()=> {
    var b = browserify({
        entries: "dist/js/app.js"
    });
    return b.bundle()
        .pipe(source("bundle.js"))
        .pipe(gulp.dest("dist/js"));
});

// .pipe($.replace('.js"></script>' , '.js?v=' + version + '"></script>'))
// .pipe($.replace('.css">' , '.css?v=' + version + '">')) // TODO