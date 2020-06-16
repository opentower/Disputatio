var am_classes = require('./argumentmap-classes')
var an_classes = require('./analysis-classes')
var comparison = require('./comparison')

export var subTest = comparison.subTest

customElements.define('disputatio-analysis', an_classes.Analysis);
customElements.define('disputatio-premise', an_classes.PremiseSpan);
customElements.define('disputatio-argumentmap', am_classes.ArgumentMap);
customElements.define('disputatio-assertion', am_classes.Assertion);
customElements.define('disputatio-cluster', am_classes.Cluster);
