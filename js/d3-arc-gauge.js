class ArcGauge {
  constructor($this, config) {
    this.container = $this;

    let defaults = {
      pi: Math.PI,
      width: 0,
      height: 0,
      innerRad: null,
      outerRad: null,
      arcThickness: 6,
      thresholdArcThickness: 3,
      fontFamily: "Helvetica",
      meterFontSize: 10,
      minMeterFontColor: "#fafafa",
      maxMeterFontColor: "#fafafa",
      valueFontSize: 20,
      valueFontColor: "#fafafa",
      min: 0,
      value: 0,
      max: 100,
      arcBackFillColor: "#fafafa",
      arcDefaultColor: "#3fabd4",
      duration: 500,
      decimal: 1,
      unit: null,
      markerYOffset: 3,
      lowerThresholdColor: '#e53935',
      upperThresholdColor: '#e53935',
      defaultThresholdBgColor: '#66bb6a',
      thresholds: [],
      thresholdsEnabled: false,
      thresholdArcHoverThickness: 3
    }

    Object.assign(this, defaults, config);

    this.currentColor = this.bottomThresholdColor;
    this.newColor = this.arcDefaultColor;

    this.gaugeScale = d3.scaleLinear()
      .domain([this.min, this.max])
      .range([-this.pi / 2, this.pi / 2])
      .clamp(true);

    this.d3Arc = d3.arc();

    this.init();
  }

  init() {
    this.processThreshold();
    this.initSvg();
    this.initGroup();
    this.addLabelsForDimensionCalculation();
    this.calculateDimensions();
    this.calculateThresholds();
    this.addArc();
    this.repositionMeter();
    this.updateValue(this.value);
    this.repositionAll();
    this.hover();
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
        this.thresholdsEnabled = true;
      }
    }
  }

  initSvg() {
    this.width = this.container.outerWidth();
    this.height = this.container.outerHeight();
    let viewBoxDef = `0, 0, ${this.width}, ${this.height}`;

    this.svgContainer = d3.select(this.container[0])
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", viewBoxDef);
  }

  initGroup() {
    let transform = `translate(${this.width / 2}, ${this.height / 2})`;

    this.g = this.svgContainer
      .append("g")
      .attr("transform", transform);
  }

  addLabelsForDimensionCalculation() {
    let that = this;

    //add numbers
    this.minText = this.g.append("text")
      .attr("text-anchor", "middle")
      .style("font-family", "Helvetica")
      .style("font-size", this.meterFontSize)
      .style("fill", this.minMeterFontColor)
      .text(this.min);

    this.maxText = this.g.append("text")
      .attr("text-anchor", "middle")
      .style("font-family", "Helvetica")
      .style("font-size", this.meterFontSize)
      .style("fill", this.maxMeterFontColor)
      .text(this.max);

    this.valueText = this.g.append("text")
      .attr("text-anchor", "middle")
      .style("font-family", "Helvetica")
      .style("font-size", this.valueFontSize)
      .style("fill", this.valueFontColor)
      .text(this.textFormatter(this.value)); // initially set the value to minimum value.
  }

  calculateDimensions() {
    // first, see if text fits with max arc width
    // if not, meterXOffset will be non-zero and will be subtracted from arc width.

    // get possible width for arc.
    let maxMeterWidth = Math.max(this.maxText.node().getBBox().width, this.minText.node().getBBox().width);
    let maxMeterHeight = Math.max(this.maxText.node().getBBox().height, this.minText.node().getBBox().height);
    let meterXOffset = Math.max(0, maxMeterWidth - this.arcThickness);
    let possibleWidth = this.width - meterXOffset; // SHOULD OFFSET BE HALF?

    // get possible height for arc.
    let heightOfLabels = maxMeterHeight + this.markerYOffset;

    let possibleHeight = this.height - heightOfLabels;

    if (this.thresholdsEnabled) {
      possibleHeight = possibleHeight - this.thresholdArcThickness - this.thresholdArcHoverThickness;
      possibleWidth = possibleWidth - this.thresholdArcThickness - this.thresholdArcHoverThickness
    }

    this.outerRad = Math.min(possibleWidth / 2, possibleHeight);
    this.innerRad = this.outerRad - this.arcThickness;
  }

  calculateThresholds() {
    if (this.thresholdsEnabled) {
      this.thresholdArray = [];
      this.thresholdTooltips = [];

      this.thresholdBgArc = d3.arc()
        .innerRadius(this.outerRad)
        .outerRadius(this.outerRad + this.thresholdArcThickness)
        .startAngle(-90 * (this.pi / 180))
        .endAngle(90 * (this.pi / 180));

      // this.thresholdBg = this.g.append('path')
      //   .style('fill', this.defaultThresholdBgColor)
      //   .attr('d', this.thresholdBgArc);

      for (const threshold of this.alarmThresholds) {
        if (threshold.type === 'low') {
          this.lowerThreshold = this.g.append('path')
            .datum({
              startAngle: -90 * (this.pi / 180),
              endAngle: this.gaugeScale(threshold.value),
              innerRadius: this.outerRad,
              outerRadius: this.outerRad + this.thresholdArcThickness
            })
            .style('fill', this.lowerThresholdColor)
            .attr('d', this.d3Arc);

          this.lowerThresholdTooltip = d3.select(this.container[0]).append('div')
            .datum({ name: threshold.name, value: threshold.value, type: threshold.type })
            .html(function(d) { return '<div>Name: ' + d.name + '</div>' + '<div>Value: ' + d.value + '</div>' + '<div>Type: ' + d.type + '</div>'; })
            .style('position', 'absolute')
            .style('left', `${-20}px`)
            .style('top', `${this.svgContainer.node().getBBox().height/2 - 20}px`)
            .style('padding', '8px')
            .style('background', 'rgba(97,97,97,0.9)')
            .style('color', '#fff')
            .style('font-family', "'Roboto', 'Helvetica', 'Arial', sans-serif")
            .style('font-size', '10px')
            .style('display', 'none')
            .style('-webkit-animation', 'pulse 200ms cubic-bezier(0, 0, 0.2, 1) forwards')
            .style('animation', 'pulse 200ms cubic-bezier(0, 0, 0.2, 1) forwards');

          this.thresholdArray.push(this.lowerThreshold);

          this.lowerThresholdEnabled = true;
        }

        if (threshold.type === 'high') {
          this.upperThreshold = this.g.append('path')
            .datum({
              startAngle: this.gaugeScale(threshold.value),
              endAngle: 90 * (this.pi / 180),
              innerRadius: this.outerRad,
              outerRadius: this.outerRad + this.thresholdArcThickness
            })
            .style('fill', this.upperThresholdColor)
            .attr('d', this.d3Arc);

          this.upperThresholdTooltip = d3.select(this.container[0]).append('div')
            .datum({ name: threshold.name, value: threshold.value, type: threshold.type })
            .html(function(d) { return '<div>Name: ' + d.name + '</div>' + '<div>Value: ' + d.value + '</div>' + '<div>Type: ' + d.type + '</div>'; })
            .style('position', 'absolute')
            .style('right', `${-20}px`)
            .style('top', `${this.svgContainer.node().getBBox().height/2 - 20}px`)
            .style('padding', '8px')
            .style('background', 'rgba(97,97,97,0.9)')
            .style('color', '#fff')
            .style('font-family', "'Roboto', 'Helvetica', 'Arial', sans-serif")
            .style('font-size', '10px')
            .style('display', 'none')
            .style('-webkit-animation', 'pulse 200ms cubic-bezier(0, 0, 0.2, 1) forwards')
            .style('animation', 'pulse 200ms cubic-bezier(0, 0, 0.2, 1) forwards');

          this.thresholdArray.push(this.upperThreshold);

          this.upperThresholdEnabled = true;
        }
      }
    }
  }

  addArc() {
    this.arc = d3.arc()
      .innerRadius(this.innerRad)
      .outerRadius(this.outerRad)
      .startAngle(-90 * (this.pi / 180));

    this.foregroundArc = d3.arc()
      .innerRadius(this.innerRad - 0.3)
      .outerRadius(this.outerRad + 0.3)
      .startAngle(-90 * (this.pi / 180));

    this.background = this.g.append("path")
      .datum({endAngle: 90 * (this.pi / 180)})
      .style("fill", this.arcBackFillColor)
      .attr("d", this.arc);

    this.foreground = this.g.append("path")
      .datum({endAngle: -90 * (this.pi / 180)})
      .style("fill", this.arcDefaultColor)
      .attr("d", this.foregroundArc);
  }

  repositionMeter() {
    let xOffset = (this.outerRad - this.innerRad) / 2 + this.innerRad;
    let yOffset = this.meterFontSize + this.markerYOffset;
    let minDef = `translate(${-xOffset}, ${yOffset})`;
    let maxDef = `translate(${xOffset - 3}, ${yOffset})`;

    this.minText.attr("transform", minDef);
    this.maxText.attr("transform", maxDef);
  }

  updateValue(val) {
    let angle = this.gaugeScale(val);

    this.setValue(val);

    this.animateArc(angle);

    this.tweenText(val);
  }

  update(values) {
    if(typeof values.color !== "undefined") {
      this.newColor = values.color;
    }
    if(typeof values.value !== "undefined") {
      this.setValue(values.value);
    }

    let angle = this.gaugeScale(this.value);
    this.animateArc(angle);
    this.tweenText(this.value);
  }

  textFormatter(val) {
    if (this.unit !== null) {
      return `${parseFloat(val).toFixed(this.decimal)} ${this.unit}`;
    }
    return parseFloat(val).toFixed(this.decimal);
  }

  setValue(val) {
    if (typeof val !== 'undefined' || val !== null) {
      this.value = val;
    }
  }

  animateArc(angle) {
    let that = this;
    this.foreground.transition().duration(this.duration).styleTween("fill", function () {
      return d3.interpolateRgb(that.currentColor, that.newColor); //returns function(t) that returns rgb values based on t.
    }).attrTween("d", function (d) {
      let interpolate = d3.interpolate(d.endAngle, angle);
      return function (t) {
        d.endAngle = interpolate(t);
        return that.foregroundArc(d);
      };
    }).on("end", function () {
      that.currentColor = that.newColor;
    });
  }

  tweenText(val) {
    let that = this;
    this.valueText.transition()
      .duration(this.duration)
      .tween("text", function (d) {
        let node = this;
        let interpolate = d3.interpolate(that.textFormatter(node.textContent), that.textFormatter(val));
        return function (t) {
          node.textContent = that.textFormatter(interpolate(t));
        };
      });
  }

  animateColor(elem, oldColor, newColor) {
    return elem.transition().duration(this.duration).styleTween("fill", function () {
      return d3.interpolateRgb(oldColor, newColor);
    });
  }

  updateColor(options) {
    if (typeof options === "object") {
      if ("arcBackFillColor" in options) {
        this.animateColor(this.background, this.arcBackFillColor, options.arcBackFillColor)
          .on("end", () => {
            this.arcBackFillColor = options.arcBackFillColor;
          });
      }
      if ("arcDefaultColor" in options) {
        this.arcDefaultColor = options.arcDefaultColor;
        this.animateColor(this.foreground, this.currentColor, this.newColor)
          .on("end", () => {
            this.currentColor = this.newColor;
          });
      }
      if ("minMeterFontColor" in options) {
        let oldColor = this.minMeterFontColor;
        this.minMeterFontColor = options.minMeterFontColor;
        this.animateColor(this.minText, oldColor, this.minMeterFontColor);
      }
      if ("maxMeterFontColor" in options) {
        let oldColor = this.maxMeterFontColor;
        this.maxMeterFontColor = options.maxMeterFontColor;
        this.animateColor(this.maxText, oldColor, this.maxMeterFontColor);
      }
      if ("valueFontColor" in options) {
        let oldColor = this.valueFontColor;
        this.valueFontColor = options.valueFontColor;
        this.animateColor(this.valueText, oldColor, this.valueFontColor);
      }
      if ("labelFontColor" in options) {
        let oldColor = this.labelFontColor;
        this.labelFontColor = options.labelFontColor;
        this.animateColor(this.label, oldColor, this.labelFontColor);
      }
      if ("subLabelFontColor" in options) {
        let oldColor = this.subLabelFontColor;
        this.subLabelFontColor = options.subLabelFontColor;
        this.animateColor(this.subLabel, oldColor, this.subLabelFontColor);
      }
    }
  }

  setDecimal(val) {
    this.decimal = val;
    this.valueText.text(parseFloat(this.value).toFixed(this.decimal));
  }

  repositionAll() {
    let gHeight = parseFloat(this.g.node().getBBox().height);
    let xOffset = this.width / 2;
    let yOffset = Math.max(this.outerRad, this.outerRad + (this.height / 2 - gHeight / 2));

    if (this.thresholdsEnabled) {
      yOffset = yOffset + this.thresholdArcThickness + this.thresholdArcHoverThickness;
    }

    let gDef = `translate(${xOffset}, ${yOffset})`;

    this.g.attr("transform", gDef);
  }

  redraw() {
    this.destroy();
    this.init();
  }

  destroy() {
    this.svgContainer.remove();
  }

  click(callback) {
    if (typeof callback !== "function") {
      throw new Error("argument must be a function");
    }
    this.svgContainer.on("click", callback);
  }

  transitionArc(arc, targetWidth) {
    let that = this;
    arc
      .transition()
      .duration(200)
      .ease(d3.easeLinear)
      .attrTween('d', function(d) {
        let interpolator = d3.interpolateNumber(d.outerRadius, targetWidth);

        return function(t) {
          d.outerRadius = interpolator(t);
          return that.d3Arc(d);
        };
      });
  }

  hover() {
    if (this.thresholdsEnabled) {
      d3.select(this.svgContainer.node().parentNode).on('mouseleave', () => {
        if (this.lowerThresholdEnabled) {
          this.transitionArc( this.lowerThreshold, this.outerRad + this.thresholdArcThickness);
          this.lowerThresholdTooltip.style('display', 'none');
        }
        if (this.upperThresholdEnabled) {
          this.transitionArc( this.upperThreshold, this.outerRad + this.thresholdArcThickness);
          this.upperThresholdTooltip.style('display', 'none');
        }
      });

      d3.select(this.svgContainer.node().parentNode).on('mousemove', () => {
        let xCoord = d3.mouse(this.svgContainer.node())[0];
        let midPoint = this.svgContainer.node().getBBox().width/2;

        if (xCoord < midPoint) {
          if (this.lowerThresholdEnabled) {
            this.transitionArc( this.lowerThreshold, this.outerRad + this.thresholdArcThickness + this.thresholdArcHoverThickness);
            this.lowerThresholdTooltip.style('display', 'initial');
          }
          if (this.upperThresholdEnabled) {
            this.transitionArc( this.upperThreshold, this.outerRad + this.thresholdArcThickness);
            this.upperThresholdTooltip.style('display', 'none');
          }
        } else if (midPoint < xCoord) {
          if (this.lowerThresholdEnabled) {
            this.transitionArc( this.lowerThreshold, this.outerRad + this.thresholdArcThickness);
            this.lowerThresholdTooltip.style('display', 'none');
          }
          if (this.upperThresholdEnabled) {
            this.transitionArc( this.upperThreshold, this.outerRad + this.thresholdArcThickness + this.thresholdArcHoverThickness);
            this.upperThresholdTooltip.style('display', 'initial');
          }
        }
      });
    }
  }
}
