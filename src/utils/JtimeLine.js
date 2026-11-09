var JTimeLine = function() {
  var status = {
    isMouseDown: !1,
    isOver: !1,
    mousePosition: null,
    oldTime: null,
    nowTime: null,
    moved: null,
    hoverTime: "2018-12-07 12:00:00",
    hoverLeft: 0,
    timeTipShow: !1,
    timeWidthTbls: [60, 1800, 3600, 86400, 259200],
    timeUnits: [
      "范围: 1分钟; 单位: 秒",
      "范围: 30分钟; 单位: 分钟",
      "范围: 1小时; 单位: 分钟",
      "范围: 1天; 单位: 小时",
      "范围: 3天; 单位: 小时",
    ],
    drawPen: null,
    timeSection: [],
    canvasWidth: null,
    canvasHeight: null,
    timeTips: null,
  };
  var _this = this;
  Object.keys(status).forEach(function(element) {
    _this[element] = status[element];
  });
  this.options = {
    width: this.canvasWidth,
    height: 48,
    time: new Date().getTime(),
    timeSection: [],
    timeWidth: 0,
  };
  JTimeLine.prototype.subTime = function(time) {
    return time < 10 ? "0" + time : time;
  };
  JTimeLine.prototype.tranTime = function(time) {
    var stringTime = time;
    var newDate;
    if (time) {
      newDate = new Date(time);
      stringTime =
        newDate.getFullYear() +
        "/" +
        (newDate.getMonth() + 1) +
        "/" +
        newDate.getDate() +
        " " +
        this.subTime(newDate.getHours()) +
        ":" +
        this.subTime(newDate.getMinutes()) +
        ":" +
        this.subTime(newDate.getSeconds());
    }
    return stringTime;
  };
  JTimeLine.prototype.init = function(params) {
    var that = this;
    var opts = this.options;
    var callback;
    that.timeWidthTblIndex = opts.timeWidth;
    var canvas = document.querySelector(".time-line-body");
    that.drawPen = canvas.getContext("2d");
    that.nowTime = opts.time || Date.now();
    that.timeSection = opts.timeSection || [];
    that.canvasWidth = canvas.offsetWidth;
    that.canvasHeight = canvas.offsetHeight;
    that.updata();
    document
      .querySelector(".time-line-body")
      .addEventListener("mousemove", function(e) {
        that.options.readOnly || that.mousemove(e);
      });
    document
      .querySelector(".time-line-body")
      .addEventListener("mouseover", function(e) {
        that.options.readOnly || that.mouseover(e);
      });
    document
      .querySelector(".time-line-body")
      .addEventListener("mouseleave", function(e) {
        that.options.readOnly || that.mouseleave(e);
      });
    document
      .querySelector(".time-line-body")
      .addEventListener("mousedown", function(e) {
        that.options.readOnly || that.mousedown(e);
      });
    document.querySelector(".time-line-body").addEventListener("mouseup", function(e) {
      if (!that.options.readOnly) {
        callback = params.onChange;
        that.mouseUpFn(e, callback);
      }
    });
  };
  JTimeLine.prototype.mousemove = function(e) {
    var left;
    var mouseOffset;
    var timeOffsetUnit;
    var currentTime;
    if (this.isMouseDown && this.isOver) {
      mouseOffset = this.mousePosition - e.pageX;
      if (mouseOffset === 0) return;
      timeOffsetUnit = 0;
      switch (this.timeWidth) {
        case 60:
          timeOffsetUnit = 0.1;
          break;
        case 1800:
        case 3600:
          timeOffsetUnit = 3;
          break;
        case 86400:
          timeOffsetUnit = 120;
      }
      currentTime = new Date(this.oldTime).getTime() + mouseOffset * timeOffsetUnit * 1e3;
      this.updata({ time: currentTime });
      this.moved = !0;
    } else {
      left = parseInt(
        document.getElementById("canvas-container").offsetLeft,
        10
      );
      this.mousePosition = e.pageX - left;
      this.updata();
    }
  };
  JTimeLine.prototype.mousedown = function(e) {
    this.isMouseDown = !0;
    this.mousePosition = e.pageX;
    this.oldTime = this.nowTime;
  };
  JTimeLine.prototype.mouseover = function(e) {
    this.isOver = !0;
  };
  JTimeLine.prototype.mouseleave = function(e) {
    this.isOver = !1;
    this.isMouseDown = !1;
    this.updata();
  };
  JTimeLine.prototype.changeSize = function(timeWidth) {
    this.options.timeWidth = timeWidth;
    this.updata({ timeWidth: timeWidth });
  };
  JTimeLine.prototype.mouseUpFn = function(e, callback) {
    if (this.isMouseDown) {
      this.isMouseDown = !1;
      if (this.moved) {
        this.moved = !1;
        this.updata({ time: this.nowTime });
        this.oldTime = this.nowTime;
        callback(this.nowTime);
      }
    }
  };
  JTimeLine.prototype.readOnly = function(data) {
    this.options.readOnly = !0;
    document.querySelector(".time-line-body").style.cursor = "not-allowed";
  };
  JTimeLine.prototype.unReadOnly = function(data) {
    this.options.readOnly = !1;
    document.querySelector(".time-line-body").style.cursor = "pointer";
  };
  JTimeLine.prototype.run = function(data) {
    this.isMouseDown || this.updata(data);
  };
  JTimeLine.prototype.getTime = function(data) {
  };
  JTimeLine.prototype.updata = function(data) {
    var that = this;
    data = data || {};
    that.nowTime = data.time || that.nowTime;
    that.timeSection = data.timeSection || that.timeSection;
    that.timeWidthTblIndex = data.timeWidth || that.timeWidthTblIndex;
    that.timeWidth =
      that.timeWidthTbls[data.timeWidth || that.timeWidthTblIndex];
    that.timeUnit = that.timeUnits[data.timeWidth || that.timeWidthTblIndex];
    if (data.timeWidth === 0) {
      that.timeWidthTblIndex = 0;
      that.timeWidth = that.timeWidthTbls[0];
      that.timeUnit = that.timeUnits[0];
    }
    that.drawPen.fillStyle = "#292B36";
    that.drawPen.fillRect(0, 0, that.canvasWidth, that.canvasHeight);
    that.drawScale();
    that.drawRecord();
    that.drawOtherMsg();
    document.getElementById("canvas-container").style.width =
      this.options.width + "px";
    document.querySelector(".time-line-body").style.width = this.options.width + "px";
    document.getElementById("canvas-container").style.height =
      this.options.height + "px";
    document.querySelector(".time-line-body").style.height = this.options.height + "px";
  };
  // 画刻度调用
  JTimeLine.prototype.drawSolidLine = function(drawLineParams) {
    let { startX, startY, endX, endY, lineWidth, color } = drawLineParams;
    this.drawPen.save();
    this.drawPen.strokeStyle = color;
    this.drawPen.lineWidth = lineWidth;
    this.drawPen.beginPath();
    this.drawPen.moveTo(startX, startY);
    this.drawPen.lineTo(endX, endY);
    this.drawPen.stroke();
    this.drawPen.restore();
  };
  JTimeLine.prototype.drawString = function(text, x, y, aling, color) {
    this.drawPen.font = "12px serif";
    this.drawPen.fillStyle = color || "#ffffff";
    this.drawPen.textAlign = aling || "left";
    this.drawPen.fillText(text, x, y);
  };
  // 画刻度
  JTimeLine.prototype.drawScale = function() {
    var that = this;
    var lineColor = "rgba(255,255,255,0.3)";
    var startDate = new Date(that.nowTime);
    var starSecond = startDate.getSeconds();
    var starMin = startDate.getMinutes();
    var startHours = startDate.getHours();
    var startDay = startDate.getDate();
    var startYears = startDate.getFullYear();
    var OffsetLeft = 60 * starMin + starSecond;
    var curScale = 0;
    var params;
    var timeString;
    var i;
    var dotNum;
    switch (that.timeWidth) {
      case 60:
        dotNum = parseInt(that.canvasWidth / 10);
        startDate.setSeconds(startDate.getSeconds() - parseInt(dotNum / 2, 10));
        startDay = startDate.getDate();
        startHours = startDate.getHours();
        starMin = startDate.getMinutes();
        starSecond = startDate.getSeconds();
        for (i = 0; i < dotNum; i++) {
          curScale = starSecond + i;
          startDate.setSeconds(curScale);
          if (curScale % 10 == 0) {
            params = { startX:(i * that.canvasWidth) / dotNum, startY:0, endX:(i * that.canvasWidth) / dotNum, endY:(that.canvasHeight / 5) * 1.5, lineWidth:1, color:lineColor };
            that.drawSolidLine(params);
            timeString =
              this.subTime(startDate.getHours()) +
              ":" +
              this.subTime(startDate.getMinutes()) +
              ":" +
              this.subTime(startDate.getSeconds());
            that.drawString(timeString,(i * that.canvasWidth) / dotNum,(that.canvasHeight / 5) * 2.5,"center","rgba(255,255,255,0.3)");
          } else {
            params = { startX:(i * that.canvasWidth) / dotNum, startY:0, endX:(i * that.canvasWidth) / dotNum, endY:(that.canvasHeight / 5) * 0.5, lineWidth:1, color:lineColor };
            that.drawSolidLine(params);
          }
          startDate.setDate(startDay);
          startDate.setHours(startHours);
          startDate.setMinutes(starMin);
        }
        break;
      case 1800:
        dotNum = parseInt(that.canvasWidth / 20);
        startDate.setMinutes(startDate.getMinutes() - parseInt(dotNum / 2, 10));
        startHours = startDate.getHours();
        starMin = startDate.getMinutes();
        for (i = 0; i <= dotNum; i++) {
          curScale = starMin + i;
          startDate.setMinutes(curScale);
          if (curScale % 5 == 0) {
            params = { startX:(i * that.canvasWidth) / dotNum, startY:0, endX:(i * that.canvasWidth) / dotNum, endY:(that.canvasHeight / 5) * 1.5, lineWidth:1, color:lineColor };
            that.drawSolidLine(params);
            timeString =
              this.subTime(startDate.getHours()) +
              ":" +
              this.subTime(startDate.getMinutes());
            that.drawString(timeString,(i * that.canvasWidth) / dotNum,(that.canvasHeight / 5) * 2.5,"center","rgba(255,255,255,0.3)");
          } else {
            params = { startX:(i * that.canvasWidth) / dotNum, startY:0, endX:(i * that.canvasWidth) / dotNum, endY:(that.canvasHeight / 5) * 0.5, lineWidth:1, color:lineColor };
            that.drawSolidLine(params);
          }
          startDate.setHours(startHours);
        }
        break;
      case 3600:
        dotNum = parseInt(that.canvasWidth / 20);
        startDate.setMinutes(startDate.getMinutes() - parseInt(dotNum / 2, 10));
        startHours = startDate.getHours();
        starMin = startDate.getMinutes();
        for (i = 0; i <= dotNum; i++) {
          curScale = starMin + i;
          startDate.setMinutes(curScale);
          if (curScale % 10 == 0) {
            params = { startX:(i * that.canvasWidth) / dotNum, startY:0, endX:(i * that.canvasWidth) / dotNum, endY:(that.canvasHeight / 5) * 1.5, lineWidth:1, color:lineColor };
            that.drawSolidLine(params);
            timeString =
              this.subTime(startDate.getHours()) +
              ":" +
              this.subTime(startDate.getMinutes());
            that.drawString(timeString,(i * that.canvasWidth) / dotNum,(that.canvasHeight / 5) * 2.5,"center","rgba(255,255,255,0.3)");
          } else {
            params = { startX:(i * that.canvasWidth) / dotNum, startY:0, endX:(i * that.canvasWidth) / dotNum, endY:(that.canvasHeight / 5) * 0.5, lineWidth:1, color:lineColor };
            that.drawSolidLine(params);
          }
          startDate.setHours(startHours);
        }
        break;
      case 86400:
        dotNum = parseInt(that.canvasWidth / 30);
        startDate.setHours(startDate.getHours() - parseInt(dotNum / 2, 10));
        starSecond = startDate.getSeconds();
        starMin = startDate.getMinutes();
        startHours = startDate.getHours();
        startDay = startDate.getDate();
        startYears = startDate.getFullYear();
        for (i = 0; i <= dotNum; i++) {
          curScale = startHours + i;
          startDate.setHours(curScale);
          if (curScale % 24 != 0) {
            timeString = this.subTime(startDate.getHours()) + ":00";
            params = { startX:(i * that.canvasWidth) / dotNum, startY:0, endX:(i * that.canvasWidth) / dotNum, endY:(that.canvasHeight / 5) * 0.5, lineWidth:1, color:lineColor };
            that.drawSolidLine(params);
          } else {
            timeString = startDate.toLocaleDateString();
            params = { startX:(i * that.canvasWidth) / dotNum, startY:0, endX:(i * that.canvasWidth) / dotNum, endY:(that.canvasHeight / 5) * 1, lineWidth:1, color:lineColor };
            that.drawSolidLine(params);
          }
          if (curScale % 2 == 0) {
            that.drawString(timeString,(i * that.canvasWidth) / dotNum,(that.canvasHeight / 5) * 2,"center","rgba(255,255,255,0.3)");
          }
          startDate.setFullYear(startYears);
          startDate.setDate(startDay);
          startDate.setHours(startHours);
        }
        break;
      case 259200:
        startDate.setHours(startDate.getHours() - 36);
        starSecond = startDate.getSeconds();
        starMin = startDate.getMinutes();
        startHours = startDate.getHours();
        OffsetLeft = 60 * starMin + starSecond;
        for (i = 0; i <= 72; i++) {
          curScale = startHours + i;
          if (curScale >= 24) {
            curScale %= 24;
          }
          curScale === 0? startDate.setHours(24):startDate.setHours(curScale);
          timeString = this.subTime(startDate.getHours());
          if (curScale % 3 == 0) {
            curScale || (timeString = startDate.toLocaleDateString());
            that.drawString(timeString,((3600 * i - OffsetLeft) * that.canvasWidth) / 259200,(that.canvasHeight / 5) * 2.5,"center","rgba(255,255,255,0.3)");
            params = { startX:((3600 * i - OffsetLeft) * that.canvasWidth) / 259200, startY:0, endX:((3600 * i - OffsetLeft) * that.canvasWidth) / 259200, endY:(that.canvasHeight / 5) * 1, lineWidth:1, color:lineColor };
            that.drawSolidLine(params);
          } else {
            params = { startX:((3600 * i - OffsetLeft) * that.canvasWidth) / 259200, startY:0, endX:((3600 * i - OffsetLeft) * that.canvasWidth) / 259200, endY:(that.canvasHeight / 5) * 0.5, lineWidth:1, color:lineColor };
            that.drawSolidLine(params);
          }
        }
    }
  };
  JTimeLine.prototype.getRecord = function(timeArr) {
    this.timeSection = timeArr;
  };
  // 画进度条
  JTimeLine.prototype.drawRecord = function() {
    var startPosition;
    var endPosition;
    function findPosition(time) {
      var scale = 10;
      switch (that.timeWidth) {
        case 60:
          scale = 10;
          break;
        case 1800:
        case 3600:
          scale = 20 / 60;
          break;
        case 86400:
          // 刻度为每小时 30px（drawScale: canvasWidth / 30 个小时刻度），即 30/3600 px/s；
          // 原值 20/60/60 与刻度不一致，导致 1 天档录像段错位
          scale = 30 / 3600;
          break;
      }
      var nowTimePostion = that.canvasWidth / 2;
      var position = nowTimePostion + ((time - that.nowTime) / 1e3) * scale;
      if (position > that.canvasWidth) {
        position = that.canvasWidth;
      }
      if (position <= 0) {
        position = 0;
      }
      return position;
    }
    var timeArr = this.timeSection || [];
    var that = this;
    var drawPen = that.drawPen;
    var i;
    for (i = 0; i < timeArr.length; i++) {
      startPosition = findPosition(timeArr[i].startTime);
      endPosition = findPosition(timeArr[i].endTime);
      drawPen.fillStyle = "#FF502E";
      drawPen.fillRect(
        startPosition,
        (that.canvasHeight / 5) * 3,
        endPosition - startPosition,
        (that.canvasHeight / 5) * 1.5
      );
    }
  };
  // 画中间的条
  JTimeLine.prototype.drawOtherMsg = function() {
    this.drawPen.shadowColor = "#ffffff";
    this.drawPen.shadowOffsetX = 0;
    this.drawPen.shadowOffsetY = 0;
    this.drawPen.shadowBlur = 10;
    this.drawPen.beginPath();
    this.drawPen.moveTo(this.canvasWidth / 2 - 4.5, 0);
    this.drawPen.lineTo(this.canvasWidth / 2 + 4.5, 0);
    this.drawPen.lineTo(this.canvasWidth / 2, 4.5);
    this.drawPen.fillStyle = "#fff";
    this.drawPen.closePath();
    this.drawPen.fill();
    this.drawPen.beginPath();
    this.drawPen.moveTo(this.canvasWidth / 2 - 4.5, this.canvasHeight);
    this.drawPen.lineTo(this.canvasWidth / 2 + 4.5, this.canvasHeight);
    this.drawPen.lineTo(this.canvasWidth / 2, this.canvasHeight - 4.5);
    this.drawPen.fillStyle = "#fff";
    this.drawPen.closePath();
    this.drawPen.fill();
    var params = { startX:this.canvasWidth / 2, startY:0, endX:this.canvasWidth / 2, endY:this.canvasHeight, lineWidth:2, color:"#ffffff" };
    this.drawSolidLine(params);
    this.drawPen.shadowBlur = 0;
    if (this.isOver) {
      if (!this.isMouseDown) {
        this.mouseTime =
          (this.mousePosition / this.canvasWidth) * this.timeWidth * 1e3 +
          this.nowTime -
          (this.timeWidth / 2) * 1e3;
        this.mouseString = this.tranTime(this.mouseTime);
        this.hoverTime = this.mouseString;
        this.hoverLeft = this.mousePosition - 60;
        this.timeTipShow = !0;
      } else {
        this.timeTipShow = !1;
      }
    }
  };
};

export default JTimeLine;
