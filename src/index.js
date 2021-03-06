var am_classes = require('./argumentmap-classes')
var an_classes = require('./analysis-classes')
var comparison = require('./comparison')

export var subTest = comparison.subTest

var fontstyle = document.createElement("style")
fontstyle.innerHTML = "@import url('https://fonts.googleapis.com/css2?family=Crimson+Pro&display=swap');"
document.head.appendChild(fontstyle)

customElements.define('disputatio-analysis', an_classes.Analysis);
customElements.define('disputatio-premise', an_classes.PremiseSpan);
customElements.define('disputatio-argumentmap', am_classes.FreeformDebateMap);
customElements.define('disputatio-scaffolded-map', am_classes.ScaffoldedDebateMap);
customElements.define('disputatio-keyboard-map', am_classes.KeyboardFreeformDebateMap);
customElements.define('disputatio-assertion', am_classes.Assertion);
customElements.define('disputatio-mut-assertion', am_classes.MutableAssertion);
customElements.define('disputatio-im-assertion', am_classes.ImmutableAssertion);
customElements.define('disputatio-cluster', am_classes.Cluster);
