/**
 * Ring-buffer metrics collector for observability.
 *
 * Tracks counters, timings, and gauges with a fixed-size ring buffer.
 * Renders Prometheus-format output via renderPrometheus().
 */

var MAX_SAMPLES = 1000;

function RingBuffer(maxSize) {
  this.maxSize = maxSize || MAX_SAMPLES;
  this.buffer = [];
}

RingBuffer.prototype.push = function(value) {
  this.buffer.push(value);
  if (this.buffer.length > this.maxSize) this.buffer.shift();
};

RingBuffer.prototype.snapshot = function() {
  if (!this.buffer.length) return { count: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
  var sorted = this.buffer.slice().sort(function(a, b) { return a - b; });
  var sum = this.buffer.reduce(function(a, b) { return a + b; }, 0);
  return {
    count: this.buffer.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: Math.round(sum / this.buffer.length),
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
  };
};

var metrics = {
  counters: {},
  timings: {},
  gauges: {},
};

function counter(name) {
  if (!metrics.counters[name]) metrics.counters[name] = 0;
  metrics.counters[name]++;
}

function timing(name, ms) {
  if (!metrics.timings[name]) metrics.timings[name] = new RingBuffer();
  metrics.timings[name].push(ms);
}

function gauge(name, value) {
  metrics.gauges[name] = value;
}

function snapshot() {
  var out = { counters: {}, timings: {}, gauges: {} };
  for (var k in metrics.counters) out.counters[k] = metrics.counters[k];
  for (var k in metrics.timings) out.timings[k] = metrics.timings[k].snapshot();
  for (var k in metrics.gauges) out.gauges[k] = metrics.gauges[k];
  return out;
}

function renderPrometheus() {
  var lines = [];
  for (var k in metrics.counters) {
    lines.push("# TYPE " + k + " counter");
    lines.push(k + " " + metrics.counters[k]);
  }
  for (var k in metrics.timings) {
    var s = metrics.timings[k].snapshot();
    lines.push("# TYPE " + k + " gauge");
    lines.push(k + "_avg " + s.avg);
    lines.push(k + "_p95 " + s.p95);
    lines.push(k + "_p99 " + s.p99);
  }
  for (var k in metrics.gauges) {
    lines.push("# TYPE " + k + " gauge");
    lines.push(k + " " + metrics.gauges[k]);
  }
  return lines.join("\n") + "\n";
}

function reset() {
  metrics.counters = {};
  metrics.timings = {};
  metrics.gauges = {};
}

module.exports = {
  counter: counter,
  timing: timing,
  gauge: gauge,
  snapshot: snapshot,
  renderPrometheus: renderPrometheus,
  reset: reset,
};
