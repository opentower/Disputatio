var am_classes = require('./argumentmap-classes')
var comparison = require('./comparison')

export var subTest = comparison.subTest

customElements.define('disputatio-argumentmap', am_classes.ArgumentMap);
customElements.define('disputatio-assertion', am_classes.Assertion);
customElements.define('disputatio-cluster', am_classes.Cluster);
