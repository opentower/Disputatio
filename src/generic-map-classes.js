var $ = require("jquery")
var panzoom = require("panzoom")
require("jquery-ui/ui/widgets/draggable")
var RelativeLine = require("./graphical-classes")

var changed = new Event('changed')

// This is a buildingblock class for various graph widgets, with edges and
// node-focus. It provides mechanisms for tracking and maintaining state,
// but should be neutral on which kinds of nodes are in the graph, and on how
// one interacts with the graph
export class GenericMap extends HTMLElement {
    constructor() {
        super();
        this.surface = document.createElement("div")
        this.focalNodeContent = null //initialize focal node content
        this.nodes = {}              //initialize table of nodes
        this.edges = {}              //initialize table of edges
        this.history = []
        this.future = []
        this.present = JSON.stringify(this)
        this.historyLock = false
        this.svg = document.createElementNS("http://www.w3.org/2000/svg", 'svg')
        this.surface.style.width = "10000px" //setting this too narrow creates visual glitches, 
                                             //e.g. forcing assertions into a vertical stack
        this.surface.style.height = "1px"
        this.svg.style.width = "100%"
        this.svg.style.height = "100%"
        this.svg.style.position = "absolute"
        this.svg.style.pointerEvents = "none"
        this.svg.style.overflow = "visible"
        this.svg.style.zIndex = "2"
        this.appendChild(this.surface)
        this.surface.appendChild(this.svg)
        this.zoom = panzoom(this.surface, {
            zoomSpeed: 0.1,
            beforeWheel: e => { return !e.altKey },
            beforeMouseDown: e => { return !e.altKey },
        })
        this.style.zIndex = "2"
        this.surface.style.zIndex = "0"
        this.style.border = "1px solid"
        this.style.display = 'inline-block'
        this.style.position = 'relative'
        this.style.overflow = 'hidden'
        this.addEventListener("changed", _ => this.updateHistory())
        this.addEventListener('dragover', e => e.preventDefault())
        $(this).on('drag', _ => this.redrawEdges() ) 
    }

    changed() { this.dispatchEvent(changed) }

    updateHistory() {
        setTimeout(_ => {
            if (!this.historyLock) {
                let present = JSON.stringify(this)
                let change = this.present != present
                if (change) { 
                    this.history.push(this.present) 
                    this.present = present
                    console.log('updated')
                }
                this.future = [] //reset future
                this.historyLock = true //lock history until timeout fires
            }
            clearTimeout(this.historyTimeout)
            this.historyTimeout = setTimeout(_ => this.historyLock = false, 250)
        }, 50) //timeout here to make sure updates are finished
    }

    undo() { 
        this.historyLock = true
        this.clear()
        if (this.history.length > 0) {
            let past = this.history.pop()
            this.future.push(this.present)
            this.present = past
            this.fromJSON(past)
        } else { console.log("no history") }
    }

    redo() { 
        this.historyLock = true
        if (this.future.length > 0) {
            this.clear()
            let future = this.future.pop()
            this.history.push(this.present)
            this.present = future
            this.fromJSON(future)
        } else { console.log("no future") }
    }

    clear() { 
        for (var key in this.edges) this.edges[key].remove()
        while (this.surface.lastChild.tagName != "svg") this.surface.removeChild(this.surface.lastChild)
        this.edges = {}
        this.nodes = {}
    }

    redrawEdges() { 
        for (var key in this.edges) this.edges[key].updatePosition() 
    }

    toJSON () { 
        return {
            nodes: this.nodes,
            focus: this.focalNode,
        }
    }

    set focalNode(n) { 
        if (this.focalNode) {
            this.focalNodeContents.style.borderWidth = "1px"
            this.focalNodeContents.classList.remove('focalNode')
        }
        this.focalNodeContents = n
        if (this.focalNode) {
            this.focalNodeContents.style.borderWidth = "2px"
            this.focalNodeContents.classList.add('focalNode')
        }
    }

    get focalNode() { return this.focalNodeContents }
        
    get transform() { return this.zoom.getTransform() }

    createEdge(n1,n2) {
        var line
        if (n2.isClusterNode && n2.uniqueOutgoing) {
            line = new RelativeLine(n1, n2.uniqueOutgoing.label, this)
        } else { 
            line = new RelativeLine(n1, n2, this)
        }
        line.uuid = Math.random().toString(36).substring(2) //generate unique identifier
        this.edges[line.uuid] = line
        n1.outgoing[n2.uuid] = line
        n2.incoming[n1.uuid] = line
        line.path.id = line.uuid
        this.changed()
    }

    fromJSON() { throw "Deserialization is not yet supported generically" }

    removeEdge(n1,n2) {
        if (n1 && n2) {
            let line = n1.outgoing[n2.uuid]
            delete this.edges[line.uuid]
            delete n1.outgoing[n2.uuid]
            delete n2.incoming[n1.uuid]
            line.remove()
        }
        this.changed()
    }

    contains(node) {
        let containers = []
        for (var key in this.nodes) {
            let val = this.nodes[key]
            let rect1 = val.getBoundingClientRect()
            let rect2 = node.getBoundingClientRect()
            if ((rect1.x < rect2.x) && (rect1.x + rect1.width > rect2.x)
             && (rect1.y < rect2.y) && (rect1.y + rect1.height > rect2.y)
             ) containers.push(val)
        }
        return containers
    }
}

export class GenericNode extends HTMLElement {
    constructor(parent,x,y, config) {
        super();
        this.map = parent
        if (!config) config = {}
        if (config.uuid) this.uuid = config.uuid
        else this.uuid = Math.random().toString(36).substring(2) //generate unique identifier
        this.map.nodes[this.uuid] = this //register in the map
        this.incoming = {} //initialize table of incoming edges
        this.outgoing = {} //initialize table of outgoing edges
        this.style.position = 'absolute'
        this.style.display= 'inline-block'
        this.style.border = '1px solid gray'
        this.style.padding = '10px'
        this.top = y
        this.left = x

        let bg = document.createElement("div");
        bg.style.display = 'inline-block'
        bg.style.position = 'absolute'
        bg.style.background = 'white'
        bg.style.top = 0
        bg.style.left = 0
        bg.style.height = '100%'
        bg.style.width = '100%'
        bg.mapNode = this

        this.appendChild(bg);
        this.attach(parent)
        this.initDrag(1)
        $(this).on("dragstop", _ => this.map.changed() )
    }

    initDrag (translationFactor) { 
        //need to reinitialize the drag object when reattaching the node
        //when dragging, need to translate when attached to map, and not otherwise
        $(this).draggable({
            start: function(event, ui) {
                ui.position.left = 0
                ui.position.top = 0
            },
            drag: function(event, ui) {
                var trans = this.map.transform
                var changeLeft = ui.position.left - (ui.originalPosition.left + (trans.x * translationFactor)); // find change in left
                var newLeft = ui.originalPosition.left + changeLeft / trans.scale; // adjust new left by our zoomScale
                var changeTop = ui.position.top - (ui.originalPosition.top + (trans.y * translationFactor)); // find change in top
                var newTop = ui.originalPosition.top + changeTop / trans.scale; // adjust new top by our zoomScale
                ui.position.left = newLeft;
                ui.position.top = newTop;
            }
        });
    };

    clearOutgoing() { for (var key in this.outgoing) this.map.removeEdge(this,this.map.nodes[key]) }

    clearIncoming() { for (var key in this.incoming) this.map.removeEdge(this.map.nodes[key],this) }

    detach() {
        this.clearOutgoing()
        this.clearIncoming()
        if (this.cluster) delete this.cluster.nodes[this.uuid]; //delete from nodes if in cluster
        delete this.map.nodes[this.uuid] //delete from map
        if (this.parentNode) this.parentNode.removeChild(this); //remove if parent exists
        if (this.map.focalNode == this) this.map.focalNode = null
    }

    attach(parent) { parent.surface.appendChild(this); }

    get top() { return parseInt(this.style.top) }
 
    set top(y) { this.style.top = y + "px" }

    get left() { return parseInt(this.style.left) }

    set left(x) { this.style.left = x + "px" }

    set dragStart(f) { $(this).draggable("option","start",f) }

    set dragStop(f) { $(this).draggable("option","stop",f) }

    toJSON() { 
        return { 
            config: {
                uuid: this.uuid,
            },
            incoming: Object.keys(this.incoming),
            outgoing: Object.keys(this.outgoing),
            top: this.top,
            left: this.left,
            role: "none",
        }
    }
}