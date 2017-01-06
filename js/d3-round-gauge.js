class RoundGauge {
  constructor(config) {
    let defaults = {
      gaugeRadius: 200,
      minVal: 0,
      maxVal: 100,
      divID: "vizBox",
      needleVal: 60,
      gaugeUnits: "%",
      precision: 2,
      paddingRatio: 0,
      edgeWidthRatio: 0.05,
      tickEdgeGapRatio: 0.05,
      tickLengthMajRatio: 0.15,
      tickLengthMinRatio: 0.05,
      needleTickGapRatio: 0.02,
      needleLengthNegRatio: 0.2,
      pivotRadiusRatio: 0.1,
      ticknessGaugeBasis: 200,
      needleWidthRatio: 5,
      tickWidthMajRatio: 3,
      tickWidthMinRatio: 1,
      labelFontSizeRatio: 18,
      valueLabelFontSize: 20,
      tickLabelFontSize: 10,
      zeroTickAngle: 60,
      maxTickAngle: 300,
      zeroNeedleAngle: 40,
      maxNeedleAngle: 320,
      tickColMaj: '#3fabd4',
      tickColMin: '#000',
      outerEdgeCol: '#3fabd4',
      pivotCol: '#999',
      innerCol: '#fff',
      unitsLabelCol: '#000',
      tickLabelCol: '#000',
      needleCol: '#3fabd4',
      tickFont: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      unitsFont: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      ease: d3.easePolyInOut.exponent(4),
      transitionDuration: 1000,
      thresholdArcThicknessRatio: 0.2,
      defaultThresholdBgColor: '#c8e6c9',
      lowerThresholdColor: '#e57373',
      upperThresholdColor: '#e57373',
      pi: Math.PI,
      thresholds: []
    };
    Object.assign(this, defaults, config);

    this.init();
  }

  init() {
    this.calculateDefaults();
    this.drawSvg();
    this.drawCircle();
    this.processThreshold();
    this.drawThresholdArc();
    this.drawTicks();
    this.drawValueLabel();
    this.drawNeedle();
    this.tweenElements();
    this.hover();
  }

  calculateDefaults() {
    let width = d3.select(`#${this.divID}`).node().clientWidth;
    let height = d3.select(`#${this.divID}`).node().clientHeight;
    this.gaugeRadius = Math.min(width, height)/2;

    this.padding = this.paddingRatio * this.gaugeRadius;
    this.edgeWidth = this.edgeWidthRatio * this.gaugeRadius;
    this.tickEdgeGap = this.tickEdgeGapRatio * this.gaugeRadius;
    this.tickLengthMaj = this.tickLengthMajRatio * this.gaugeRadius;
    this.tickLengthMin = this.tickLengthMinRatio * this.gaugeRadius;
    this.needleTickGap = this.needleTickGapRatio * this.gaugeRadius;
    this.needleLengthNeg = this.needleLengthNegRatio * this.gaugeRadius;
    this.pivotRadius = this.pivotRadiusRatio * this.gaugeRadius;

    this.needleWidth = this.needleWidthRatio * (this.gaugeRadius / this.ticknessGaugeBasis);
    this.tickWidthMaj = this.tickWidthMajRatio * (this.gaugeRadius / this.ticknessGaugeBasis);
    this.tickWidthMin = this.tickWidthMinRatio * (this.gaugeRadius / this.ticknessGaugeBasis);

    if ( typeof this.tickSpaceMajVal === 'undefined' ) {
      var scale = d3.scaleLinear().domain([this.minVal, this.maxVal]);
      this.tickSpaceMajVal = scale.ticks(4)[1] - this.minVal;
      this.tickSpaceMinVal = this.tickSpaceMajVal / 4;
    }

    //Calculate required values
    this.needleLengthPos = this.gaugeRadius - this.padding - this.edgeWidth - this.tickEdgeGap - this.tickLengthMaj - this.needleTickGap;
    this.needlePathLength = this.needleLengthNeg + this.needleLengthPos;
    this.needlePathStart = this.needleLengthNeg * (-1);
    this.tickStartMaj = this.gaugeRadius - this.padding - this.edgeWidth - this.tickEdgeGap - this.tickLengthMaj;
    this.tickStartMin = this.gaugeRadius - this.padding - this.edgeWidth - this.tickEdgeGap - this.tickLengthMin;
    this.labelStart = this.tickStartMaj - this.valueLabelFontSize/2;
    this.innerEdgeRadius = this.gaugeRadius - this.padding - this.edgeWidth;
    this.outerEdgeRadius = this.gaugeRadius - this.padding;
    this.originX = this.gaugeRadius;
    this.originY = this.gaugeRadius;

    //Define a linear scale to convert values to needle displacement angle (degrees)
    this.valueScale = d3.scaleLinear()
      .domain([this.minVal, this.maxVal])
      .range([this.zeroTickAngle, this.maxTickAngle]);

    //Calculate tick mark angles (degrees)
    let counter = 0;
    this.tickDataMaj = [];
    this.tickAnglesMaj = [];
    this.tickAnglesMin = [];
    this.tickLabelData = [];
    this.tickLabelText = [];
    this.tickSpacingMajDeg = this.valueScale(this.tickSpaceMajVal) - this.valueScale(0);

    this.tickSpacingMinDeg = this.valueScale(this.tickSpaceMinVal) - this.valueScale(0);

    for ( let i = this.zeroTickAngle; i <= this.maxTickAngle; i = i + this.tickSpacingMajDeg ) {
      if ( (i === this.zeroTickAngle) || (i === this.maxTickAngle)) {
        this.tickLabelData.push({ angle: this.zeroTickAngle + (this.tickSpacingMajDeg * counter), color: this.tickColMaj });
        this.tickLabelText.push(this.minVal + (this.tickSpaceMajVal * counter));
      }
      this.tickDataMaj.push({ angle: this.zeroTickAngle + (this.tickSpacingMajDeg * counter), color: this.tickColMaj });       
      this.tickAnglesMaj.push(this.zeroTickAngle + (this.tickSpacingMajDeg * counter));
      counter++;
    }

    counter = 0;
    for ( let i = this.zeroTickAngle; i <= this.maxTickAngle; i = i + this.tickSpacingMinDeg ) {
      //Check for an existing major tick angle
      var exists = 0;
      for ( const d in this.tickDataMaj ) {
        let data = this.zeroTickAngle + (this.tickSpacingMinDeg * counter);

        if ( data === d.angle ) {
          exists = 1;
        }
      }

      if ( exists === 0 ) {
        this.tickAnglesMin.push(this.zeroTickAngle + (this.tickSpacingMinDeg * counter));
      }
      counter++;
    }

    //Add the svg content holder to the visualisation box element in the document (vizbox)
    this.svgWidth = this.gaugeRadius * 2;
    this.svgHeight = this.gaugeRadius * 2;
  }

  drawSvg() {
    this.svg = d3.select("#" + this.divID).append("svg");

    this.svg.attr("id", "SVGbox-" + this.divID)
      .attr("width", '100%')
      .attr("height", '100%')
      .attr('viewBox', `0,0,${this.svgWidth},${this.svgHeight}`)
      .attr({ 'xmlns': 'http://www.w3.org/2000/svg', 'xmlns:xlink': 'http://www.w3.org/1999/xlink' });
  }

  drawCircle() {
    //Draw the circles that make up the edge of the gauge
    this.circleGroup = this.svg.append("svg:g")
      .attr("id", "circles")
      .attr('transform', `translate(${this.originX}, ${this.originY})`);

    this.outerC = this.circleGroup.append("svg:circle")
      .datum({ color: this.outerEdgeCol })
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", this.outerEdgeRadius)
      .style("fill", this.outerEdgeCol)
      .style("stroke", "none");
    this.innerC = this.circleGroup.append("svg:circle")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", this.innerEdgeRadius)
      .style("fill", this.innerCol)
      .style("stroke", "none");

    //Draw the circle for the needle 'pivot'
    this.pivotC = this.circleGroup.append("svg:circle")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", this.pivotRadius)
      .style("fill", this.pivotCol)
      .style("stroke", "none");
  }

  processThreshold() {
    if (this.thresholds.length > 0) {
      this.thresholds = this.thresholds.map((threshold) => {
        threshold.type = threshold.type.toLowerCase();
        return threshold;
      });

      this.thresholds.sort((a, b) => {
        if (a.value > b.value) {
          return 1;
        }
        if (a.value < b.value) {
          return -1;
        }
        return 0;
      });

      this.alarmThresholds = this.thresholds.filter((threshold) => {
        return threshold.alarm === true;
      });

      if (this.alarmThresholds.length > 0) {
        this.thresholdEnabled = true;
      }
    }
  }

  drawThresholdArc() {
    if (this.thresholdEnabled) {
      this.thresholdArray = [];
      this.thresholdTooltips = [];

      this.thresholdArc = d3.arc();

      this.thresholdBg = this.circleGroup.append('path')
        .datum({
        startAngle: (-180 + this.zeroTickAngle) * (this.pi / 180),
        endAngle: (this.maxTickAngle - 180) * (this.pi / 180),
        innerRadius: this.innerEdgeRadius * (1 - this.thresholdArcThicknessRatio),
        outerRadius: this.innerEdgeRadius
      })
        .style('fill', this.defaultThresholdBgColor)
        .attr('d', this.thresholdArc);

      for (const threshold of this.alarmThresholds) {
        if (threshold.type === 'low') {
          this.lowerThreshold = this.circleGroup.append('path')
            .datum({
            startAngle: (-180 + this.zeroTickAngle) * (this.pi / 180),
            endAngle: (this.valueScale(threshold.value) - 180) * (this.pi / 180),
            innerRadius: this.innerEdgeRadius * (1 - this.thresholdArcThicknessRatio),
            outerRadius: this.innerEdgeRadius
          })
            .style('fill', this.lowerThresholdColor)
            .attr('d', this.thresholdArc);

          this.lowerThresholdTooltip = d3.select(this.svg.node().parentNode).append('div')
            .datum({ name: threshold.name, value: threshold.value, type: threshold.type })
            .html(function(d) { return '<div>Name: ' + d.name + '</div>' + '<div>Value: ' + d.value + '</div>' + '<div>Type: ' + d.type + '</div>'; })
            .style('position', 'absolute')
            .style('left', `${-20}px`)
            .style('bottom', `${this.svg.node().getBBox().height/2}px`)
            .style('padding', '8px')
            .style('background', 'rgba(97,97,97,0.9)')
            .style('color', '#fff')
            .style('font-family', "'Roboto', 'Helvetica', 'Arial', sans-serif")
            .style('font-size', '10px')
            .style('display', 'none');

          this.thresholdArray.push(this.lowerThreshold);

          this.lowerThresholdEnabled = true;
        }

        if (threshold.type === 'high') {
          this.upperThreshold = this.circleGroup.append('path')
            .datum({
            startAngle: (-180 + this.valueScale(threshold.value)) * (this.pi / 180),
            endAngle: (this.maxTickAngle - 180) * (this.pi / 180),
            innerRadius: this.innerEdgeRadius * (1 - this.thresholdArcThicknessRatio),
            outerRadius: this.innerEdgeRadius
          })
            .style('fill', this.upperThresholdColor)
            .attr('d', this.thresholdArc);

          this.upperThresholdTooltip = d3.select(this.svg.node().parentNode).append('div')
            .datum({ name: threshold.name, value: threshold.value, type: threshold.type })
            .html(function(d) { return '<div>Name: ' + d.name + '</div>' + '<div>Value: ' + d.value + '</div>' + '<div>Type: ' + d.type + '</div>'; })
            .style('position', 'absolute')
            .style('right', `${-20}px`)
            .style('bottom', `${this.svg.node().getBBox().height/2}px`)
            .style('padding', '8px')
            .style('background', 'rgba(97,97,97,0.9)')
            .style('color', '#fff')
            .style('font-family', "'Roboto', 'Helvetica', 'Arial', sans-serif")
            .style('font-size', '10px')
            .style('display', 'none');

          this.thresholdArray.push(this.upperThreshold);

          this.upperThresholdEnabled = true;
        }
      }
    }
  }

  drawTicks() {
    let that = this;
    this.majorTicks = [];

    this.pathTickMaj = this.tickCalcMaj();
    this.pathTickMin = this.tickCalcMin();

    this.ticks = this.svg.append("svg:g")
      .attr("id", "tickMarks");

    //Add a groups for major and minor ticks (minor first, so majors overlay)
    this.ticksMin = this.ticks.append("svg:g")
      .attr("id", "minorTickMarks");
    this.ticksMaj = this.ticks.append("svg:g")
      .attr("id", "majorTickMarks");

    //Draw the tick marks
    this.tickMin = this.ticksMin.selectAll("path")
      .data(this.tickAnglesMin)
      .enter().append("path")
      .attr("d", this.pathTickMin)
      .style("stroke", this.tickColMin)
      .style("stroke-width", this.tickWidthMin + "px");

    this.tickMaj = this.ticksMaj.selectAll("path")
      .data(this.tickDataMaj)
      .enter().append("path")
      .attr("d", this.pathTickMaj)
      .style("stroke", this.tickColMaj)
      .style("stroke-width", this.tickWidthMaj + "px");

    this.tickLabels = this.svg.append("svg:g")
      .attr("id", "tickLabels");
    this.tickLabel = this.tickLabels.selectAll("text")
      .data(this.tickLabelData)
      .enter().append("text")
      .attr("x", function (d, i) {return that.labelXcalc(d, i);})
      .attr("y", function (d, i) {return that.labelYcalc(d, i);})
      .attr("font-size", this.tickLabelFontSize)
      .attr("text-anchor", "middle")
      .style("fill", this.tickLabelCol)
      .style("font-weight", "bold")
      .attr("font-family", this.tickFont)
      .text(function (d, i) {return that.tickLabelText[i];});
  }

  drawValueLabel() {
    let that = this;
    //Add label for units
    this.unitLabels = this.svg.append("svg:g")
      .attr("id", "unitLabels");
    this.unitsLabel = this.unitLabels.selectAll("text")
      .data([{angle:0}])
      .enter().append("text")
      .attr("font-size", this.valueLabelFontSize)
      .attr("text-anchor", "middle")
      .style("fill", this.unitsLabelCol)
      .style("font-weight", "bold")
      .attr("font-family", this.unitsFont)
      .text(this.gaugeUnits)
      .attr('transform', `translate(${this.svgWidth/2}, ${this.svgHeight - this.valueLabelFontSize})`);
  }

  dToR(angleDeg) {
    //Turns an angle in degrees to radians
    var angleRad = angleDeg * (Math.PI / 180);
    return angleRad;
  }

  tickCalcMaj() {
    let that = this;

    function pathCalc(d, i) {
      //Offset the tick mark angle so zero is vertically down, then convert to radians
      let tickAngle = d.angle + 90,
          tickAngleRad = that.dToR(tickAngle);

      var y1 = that.originY + (that.tickStartMaj * Math.sin(tickAngleRad)),
          y2 = that.originY + ((that.tickStartMaj + that.tickLengthMaj) * Math.sin(tickAngleRad)),
          x1 = that.originX + (that.tickStartMaj * Math.cos(tickAngleRad)),
          x2 = that.originX + ((that.tickStartMaj + that.tickLengthMaj) * Math.cos(tickAngleRad)),

          lineData = [{ "x": x1, "y": y1 }, { "x": x2, "y": y2 }];

      //Use a D3.JS path generator
      var lineFunc = d3.line()
      .x(function (d) {return d.x;})
      .y(function (d) {return d.y;});

      var lineSVG = lineFunc(lineData);

      return lineSVG;
    }

    return pathCalc;
  }

  tickCalcMin() {
    let that = this;

    function pathCalc(d, i) {
      //Offset the tick mark angle so zero is vertically down, then convert to radians
      var tickAngle = d + 90,
          tickAngleRad = that.dToR(tickAngle);

      var y1 = that.originY + (that.tickStartMin * Math.sin(tickAngleRad)),
          y2 = that.originY + ((that.tickStartMin + that.tickLengthMin) * Math.sin(tickAngleRad)),
          x1 = that.originX + (that.tickStartMin * Math.cos(tickAngleRad)),
          x2 = that.originX + ((that.tickStartMin + that.tickLengthMin) * Math.cos(tickAngleRad)),

          lineData = [{ "x": x1, "y": y1 }, { "x": x2, "y": y2 }];

      //Use a D3.JS path generator
      var lineFunc = d3.line()
      .x(function (d) {return d.x;})
      .y(function (d) {return d.y;});

      var lineSVG = lineFunc(lineData);

      return lineSVG;
    }

    return pathCalc;
  }

  labelXcalc(d, i) {
    var tickAngle = d.angle + 90,
        tickAngleRad = this.dToR(tickAngle),
        labelW = this.tickLabelFontSize / (this.tickLabelText[i].toString().length / 2);

    let x1 = this.originX + ((this.labelStart) * Math.cos(tickAngleRad));
    return x1;
  }

  labelYcalc(d, i) {
    var tickAngle = d.angle + 90,
        tickAngleRad = this.dToR(tickAngle),
        y1 = this.originY + ((this.labelStart) * Math.sin(tickAngleRad)) + (this.tickLabelFontSize / 2);
    return y1;
  }

  needleCalc() {
    //Define a function for calculating the coordinates of the needle paths (see tick mark equivalent)
    let that = this;

    function pathCalc(d, i) {
      var nAngleRad = that.dToR(d.angle + 90);

      var y1 = that.originY + (that.needlePathStart * Math.sin(nAngleRad)),
          y2 = that.originY + ((that.needlePathStart + that.needlePathLength) * Math.sin(nAngleRad)),
          x1 = that.originX + (that.needlePathStart * Math.cos(nAngleRad)),
          x2 = that.originX + ((that.needlePathStart + that.needlePathLength) * Math.cos(nAngleRad)),

          lineData = [{ "x": x1, "y": y1 }, { "x": x2, "y": y2 }];

      var lineFunc = d3.line()
      .x(function (d) {return d.x;})
      .y(function (d) {return d.y;});

      var lineSVG = lineFunc(lineData);
      return lineSVG;
    }

    return pathCalc;
  }

  drawNeedle() {
    this.needleAngle = [this.zeroNeedleAngle];

    let pathNeedle = this.needleCalc();

    //Add a group to hold the needle path
    this.needleGroup = this.svg.append("svg:g")
      .attr("id", "needle");

    //Draw the needle path
    this.needlePath = this.needleGroup
      .datum({angle: this.needleAngle, color: this.needleCol})
      .append("path")
      .attr("d", pathNeedle)
      .style("stroke", this.needleCol)
      .style("stroke-width", this.needleWidth + "px");
  }

  tweenElements() {
    let that = this;
    //Animate the transistion of the needle to its starting value
    this.needlePath.transition()
      .duration(this.transitionDuration)
      .ease(this.ease)
      .attrTween("transform", function (d, i, a) {
      that.needleAngle = that.valueScale(that.needleVal);

      //Check for min/max ends of the needle
      if ( that.needleAngle > that.maxTickAngle ) {
        that.needleAngle = that.maxNeedleAngle;
      }
      if ( that.needleAngle < that.zeroTickAngle ) {
        that.needleAngle = that.zeroNeedleAngle;
      }
      let needleCentre = that.originX + "," + that.originY;
      let needleRot = that.needleAngle - that.zeroNeedleAngle;

      return d3.interpolateString("rotate(0," + needleCentre + ")", "rotate(" + needleRot + "," + needleCentre + ")");
    });

    this.unitsLabel.transition()
      .duration(this.transitionDuration)
      .ease(this.ease)
      .tween("text", function (d) {
      let interpolator = d3.interpolateString(that.minVal, that.needleVal);
      let node = this;

      return function (t) {
        node.textContent = that.textFormatter(interpolator(t));
      };
    });
  }

  textFormatter(val) {
    if (this.gaugeUnits) {
      return `${parseFloat(val).toFixed(this.precision)} ${this.gaugeUnits}`;
    }
    return `${parseFloat(val).toFixed(this.precision)}`;
  }

  // Function to update the gauge value
  updateGauge(newVal) {
    let that = this;

    //Set default values if necessary
    if ( typeof newVal === undefined ) {
      newVal = this.minVal;
    }

    //Animate the transistion of the needle to its new value
    let needlePath = this.needleGroup.selectAll("path");
    let oldVal = this.needleVal;
    needlePath.transition()
      .duration(this.transitionDuration)
      .ease(this.ease)
      .attrTween("transform", function (d, i, a) {
      let needleAngleOld = that.valueScale(oldVal) - that.zeroNeedleAngle;
      let needleAngleNew = that.valueScale(newVal) - that.zeroNeedleAngle;

      //Check for min/max ends of the needle
      if ( needleAngleOld + that.zeroNeedleAngle > that.maxTickAngle ) {
        needleAngleOld = that.maxNeedleAngle - that.zeroNeedleAngle;
      }
      if ( needleAngleOld + that.zeroNeedleAngle < that.zeroTickAngle ) {
        needleAngleOld = 0;
      }
      if ( needleAngleNew + that.zeroNeedleAngle > that.maxTickAngle ) {
        needleAngleNew = that.maxNeedleAngle - that.zeroNeedleAngle;
      }
      if ( needleAngleNew + that.zeroNeedleAngle < that.zeroTickAngle ) {
        needleAngleNew = 0;
      }
      let needleCentre = that.originX + "," + that.originY;
      return d3.interpolateString("rotate(" + needleAngleOld + "," + needleCentre + ")", "rotate(" + needleAngleNew + "," + needleCentre + ")");

    });

    this.unitsLabel.transition()
      .duration(this.transitionDuration)
      .ease(this.ease)
      .tween("text", function (d) {
      let interpolator = d3.interpolateString(oldVal, newVal);
      let node = this;

      return function (t) {
        node.textContent = that.textFormatter(interpolator(t));
      };
    });

    //Update the current value
    that.needleVal = newVal;
  }

  update(values) {
    let that = this;
    let oldVal = this.needleVal;

    if ( typeof values.color !== "undefined" ) {
      this.needleCol = values.color;
    }
    if ( typeof values.value !== "undefined" ) {
      this.needleVal = values.value;
    }

    this.outerC
      .transition()
      .duration(this.transitionDuration)
      .ease(this.ease)
      .styleTween('fill', function (d) {
      let interpolator = d3.interpolateRgb(d.color, that.needleCol);

      return function (t) {
        d.color = interpolator(t);
        return d.color;
      };
    });

    this.needlePath
      .transition()
      .duration(this.transitionDuration)
      .ease(this.ease)
      .styleTween('stroke', function (d) {
      let interpolator = d3.interpolateRgb(d.color, that.needleCol);

      return function (t) {
        d.color = interpolator(t);
        return d.color;
      };
    }).attrTween("transform", function (d, i, a) {
      let needleAngleOld = that.valueScale(oldVal) - that.zeroNeedleAngle;
      let needleAngleNew = that.valueScale(that.needleVal) - that.zeroNeedleAngle;

      //Check for min/max ends of the needle
      if ( needleAngleOld + that.zeroNeedleAngle > that.maxTickAngle ) {
        needleAngleOld = that.maxNeedleAngle - that.zeroNeedleAngle;
      }
      if ( needleAngleOld + that.zeroNeedleAngle < that.zeroTickAngle ) {
        needleAngleOld = 0;
      }
      if ( needleAngleNew + that.zeroNeedleAngle > that.maxTickAngle ) {
        needleAngleNew = that.maxNeedleAngle - that.zeroNeedleAngle;
      }
      if ( needleAngleNew + that.zeroNeedleAngle < that.zeroTickAngle ) {
        needleAngleNew = 0;
      }
      let needleCentre = that.originX + "," + that.originY;
      return d3.interpolateString("rotate(" + needleAngleOld + "," + needleCentre + ")", "rotate(" + needleAngleNew + "," + needleCentre + ")");
    });

    this.tickMaj
      .transition()
      .duration(this.transitionDuration)
      .ease(this.ease)
      .styleTween('stroke', function (d) {
      let interpolator = d3.interpolateRgb(d.color, that.needleCol);

      return function (t) {
        d.color = interpolator(t);
        return d.color;
      };
    });

    this.unitsLabel.transition()
      .duration(this.transitionDuration)
      .ease(this.ease)
      .tween("text", function (d) {
      let interpolator = d3.interpolateString(oldVal, that.needleVal);
      let node = this;

      return function (t) {
        node.textContent = that.textFormatter(interpolator(t));
      };
    });
  }

  redraw() {
    this.svg.remove();
    this.init();
  }

  transitionArc(arc, targetWidth) {
    let that = this;
    arc
      .transition()
      .duration(200)
      .ease(d3.easeLinear)
      .attrTween('d', function(d) {
      let interpolator = d3.interpolateNumber(d.innerRadius, targetWidth);

      return function(t) {
        d.innerRadius = interpolator(t);
        return that.thresholdArc(d);
      };
    });
  }

  hover() {
    if (this.thresholdEnabled) {
      d3.select(this.svg.node().parentNode).on('mouseleave', () => {
        if (this.lowerThresholdEnabled) {
          this.transitionArc( this.lowerThreshold, this.innerEdgeRadius * (1 - this.thresholdArcThicknessRatio));
          this.lowerThresholdTooltip.style('display', 'none');
        }
        if (this.upperThresholdEnabled) {
          this.transitionArc( this.upperThreshold, this.innerEdgeRadius * (1 - this.thresholdArcThicknessRatio));
          this.upperThresholdTooltip.style('display', 'none');
        }
      });

      d3.select(this.svg.node().parentNode).on('mousemove', () => {
        let xCoord = d3.mouse(this.svg.node())[0];
        let midPoint = this.svg.node().getBBox().width/2;

        if (xCoord < midPoint) {
          if (this.lowerThresholdEnabled) {
            this.transitionArc( this.lowerThreshold, this.innerEdgeRadius * (1 - this.thresholdArcThicknessRatio - 0.05));
            this.lowerThresholdTooltip.style('display', 'initial');
          }
          if (this.upperThresholdEnabled) {
            this.transitionArc( this.upperThreshold, this.innerEdgeRadius * (1 - this.thresholdArcThicknessRatio));
            this.upperThresholdTooltip.style('display', 'none');
          }
        } else if (midPoint < xCoord) {
          if (this.lowerThresholdEnabled) {
            this.transitionArc( this.lowerThreshold, this.innerEdgeRadius * (1 - this.thresholdArcThicknessRatio));
            this.lowerThresholdTooltip.style('display', 'none');
          }
          if (this.upperThresholdEnabled) {
            this.transitionArc( this.upperThreshold, this.innerEdgeRadius * (1 - this.thresholdArcThicknessRatio - 0.05));
            this.upperThresholdTooltip.style('display', 'initial');
          }
        }
      });
    }
  }
}