var Main, child_process, config, fs, sys;

fs = require('fs');

sys = require('sys');

child_process = require('child_process');

try {
  config = require('./config.js');
} catch (error) {
  console.log("Copy config.example.coffee to config.coffee and" + "adjust to match your environment.");
  process.exit(1);
}

Main = (function() {
  class Main {
    constructor() {
      this.detectMissingChars();
      this.progress = 0;
      this.duration = this.getDurationInDays();
      this.startDate = this.getStartDate();
      this.reportPotentialOverflow();
      this.setupOutputDir();
      this.repoInit((function() {
        this.captureLog.apply(this, arguments);
        return this.paintDay();
      }).bind(this));
    }

    getStartDate() {
      var daysBack, today, weekDayInt;
      today = new Date();
      weekDayInt = today.getDay();
      daysBack = this.duration + weekDayInt;
      return new Date(+today - (daysBack * this.DAY_DURATION_MS));
    }

    detectMissingChars() {
      var i, j, missingChars, ref;
      missingChars = '';
      for (i = j = 0, ref = config.graphText.length - 1; 0 <= ref ? j <= ref : j >= ref; i = 0 <= ref ? ++j : --j) {
        if (!this.FONT[config.graphText.charAt(i)]) {
          missingChars += charAt(i);
        }
      }
      if (missingChars) {
        console.log(`These characters are not in font.json: ${missingChars}`);
        return process.exit(1);
      }
    }

    setupOutputDir() {
      if (!fs.existsSync(config.outputDir)) {
        fs.mkdirSync(config.outputDir);
      }
      return config.outputDir = fs.realpathSync(config.outputDir) + '/';
    }

    getDurationInDays() {
      var days, i, j, letter, ref;
      days = 0;
      for (i = j = 0, ref = config.graphText.length - 1; 0 <= ref ? j <= ref : j >= ref; i = 0 <= ref ? ++j : --j) {
        letter = config.graphText.charAt(i);
        days += this.FONT[letter].width * this.DAYS_IN_WEEK;
      }
      days += this.DAYS_IN_WEEK * this.LETTER_SPACING * (config.graphText.length - 1);
      return days;
    }

    reportPotentialOverflow() {
      var durationWeeks;
      durationWeeks = Math.ceil(this.duration / this.DAYS_IN_WEEK);
      if (this.WEEKS_IN_YEAR < durationWeeks) {
        console.log(`Complete text takes ${durationWeeks} weeks, ` + `history chart shows ${this.WEEKS_IN_YEAR} full weeks.`);
        return process.exit(1);
      }
    }

    paintDay() {
      if (this.progress <= this.duration) {
        this.collectPixels();
        if (this.paintToday) {
          this.writePixelsToFile();
          return this.repoCommit((function() {
            this.captureLog.apply(this, arguments);
            this.progress++;
            return this.paintDay();
          }).bind(this));
        } else {
          this.progress++;
          return this.paintDay();
        }
      } else {
        return this.repoPush(this.done.bind(this));
      }
    }

    collectPixels() {
      var results;
      this.pointer = 0;
      this.daysInLetter = 0;
      this.indexPrev = 0;
      this.paintToday = false;
      this.pixels = [];
      results = [];
      while (this.pointer <= this.progress) {
        this.collectPixel();
        this.pointer++;
        results.push(this.daysInLetter++);
      }
      return results;
    }

    collectPixel() {
      var index, x, y;
      index = this.getLetterIndexForDay(this.pointer);
      if (index !== this.indexPrev) {
        this.daysInLetter = 0;
      }
      this.indexPrev = index;
      this.letter = config.graphText.charAt(index);
      x = Math.floor(this.daysInLetter / this.DAYS_IN_WEEK);
      y = this.daysInLetter % this.DAYS_IN_WEEK;
      this.pixels[y] = this.pixels[y] || '';
      this.paintToday = this.isLetterPixel(this.letter, x, y);
      if (this.paintToday) {
        this.x = Math.floor(this.pointer / this.DAYS_IN_WEEK);
        this.y = y;
      }
      return this.pixels[y] += this.TEXT_CHARS[+this.paintToday];
    }

    getLetterIndexForDay(day) {
      var i, j, letter, letterPointer, ref;
      letterPointer = 0;
      for (i = j = 0, ref = config.graphText.length - 1; 0 <= ref ? j <= ref : j >= ref; i = 0 <= ref ? ++j : --j) {
        letter = config.graphText.charAt(i);
        letterPointer += this.FONT[letter].width;
        if (i !== config.graphText.length - 1) {
          letterPointer += this.LETTER_SPACING;
        }
        if (letterPointer * this.DAYS_IN_WEEK >= day) {
          return i;
        }
        i++;
      }
    }

    isLetterPixel(letter, x, y) {
      var pixels;
      pixels = this.FONT[letter].pixels;
      if (pixels[y] && -1 !== pixels[y].indexOf(x)) {
        return true;
      }
      return false;
    }

    getDateForLastPixel() {
      var xyInDays;
      xyInDays = this.x * this.DAYS_IN_WEEK + this.y;
      return new Date(+this.startDate + (xyInDays * this.DAY_DURATION_MS));
    }

    reportProgress() {
      console.log(`Writing string: ${config.graphText}`);
      console.log(`Day ${this.progress} of ${this.duration}.`);
      console.log(`Currently painting letter: ${this.letter}`);
      if (this.paintToday) {
        return console.log("Today we paint!");
      }
    }

    writePixelsToFile() {
      var j, len, line, ref, str;
      str = '';
      ref = this.pixels;
      for (j = 0, len = ref.length; j < len; j++) {
        line = ref[j];
        str += `${line}\n`;
      }
      return fs.writeFileSync(config.outputDir + config.outputFile, str);
    }

    captureLog() {
      var arg, j, len, results;
      results = [];
      for (j = 0, len = arguments.length; j < len; j++) {
        arg = arguments[j];
        results.push(arg ? console.log(`shell: ${arg}`) : void 0);
      }
      return results;
    }

    repoInit(callbackFn) {
      var cmd;
      cmd = [`${__dirname}/shell/init.sh`, JSON.stringify(config.outputDir), JSON.stringify(config.repository), JSON.stringify(config.userEmail), JSON.stringify(config.userName)];
      return child_process.exec(cmd.join(' '), callbackFn);
    }

    repoCommit(callbackFn) {
      var cmd, date;
      date = this.getDateForLastPixel();
      date.setHours(11, 0, 0, 0);
      console.log(date);
      cmd = [`${__dirname}/shell/commit.sh`, JSON.stringify(config.outputDir), JSON.stringify(config.outputFile), JSON.stringify(config.commitMessage), JSON.stringify(String(date))];
      return child_process.exec(cmd.join(' '), callbackFn);
    }

    repoPush(callbackFn) {
      var cmd;
      cmd = [`${__dirname}/shell/push.sh`, JSON.stringify(config.outputDir)];
      return child_process.exec(cmd.join(' '), callbackFn);
    }

    done() {
      this.captureLog.apply(this, arguments);
      return console.log('Done!');
    }

  };

  Main.prototype.FONT = JSON.parse(fs.readFileSync(__dirname + '/font.json'));

  Main.prototype.NOW = new Date();

  Main.prototype.LETTER_SPACING = 1;

  Main.prototype.DAY_DURATION_MS = 3600 * 24 * 1000;

  Main.prototype.DAYS_IN_WEEK = 7;

  Main.prototype.WEEKS_IN_YEAR = 51;

  Main.prototype.TEXT_CHARS = [' ', '#'];

  return Main;

})();

new Main();
