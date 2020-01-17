var objects = require('./objects')
var comparison = require('./comparison')

export var subTest = comparison.subTest

customElements.define('wc-graph', objects.Graph);
customElements.define('wc-graphnode', objects.AssertionNode);
customElements.define('wc-graphnodecluster', objects.GraphNodeCluster);
