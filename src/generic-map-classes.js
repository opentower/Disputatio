var $ = require("jquery")
var panzoom = require("panzoom")
require("jquery-ui/ui/widgets/draggable")
var RelativeLine = require("./graphical-classes.js")
var genericMapCss = require("./generic-map.css").toString();

// This is an event to track changes, used for example is pushing to the undo
// stack.
var changed = new Event('changed')

//These functions are used in calculating overlap
function leftOverlap (r1,r2) {return (r1.x <= r2.x) && (r1.x + r1.width >= r2.x)}
function topOverlap (r1,r2) {return (r1.y <= r2.y) && (r1.y + r1.height >= r2.y)}
function overlap (r1,r2) {
    return (leftOverlap(r1,r2) || leftOverlap(r2,r1))
        && (topOverlap(r1,r2)  || topOverlap(r2,r1))
}

// This is a buildingblock class for various graph widgets, with edges and
// node-focus. It provides mechanisms for tracking and maintaining state,
// but should be neutral on which kinds of nodes are in the graph, and on how
// one interacts with the graph
export class GenericMap extends HTMLElement {
    constructor() {
        super();
        this.focalNodeContent = null //initialize focal node content
        this.nodes = {}              //initialize table of nodes
        this.edges = {}              //initialize table of edges
        this.history = []
        this.future = []
        this.present = JSON.stringify(this)
        this.historyLock = false
        this.svg = document.createElementNS("http://www.w3.org/2000/svg", 'svg')
        this.frame = document.createElement("div")
        this.surface = document.createElement("div")
        this.initialized = false

        this.addEventListener("changed", _ => this.updateHistory())
        this.addEventListener('dragover', e => e.preventDefault())
        $(this.frame).on('drag', _ => this.redrawEdges() ) 
        this.shadow = this.attachShadow({mode: 'open'})
    }

    connectedCallback() {
        // per WHATWG spec 4.13.2, styling and attaching children should be deferred until attached to the DOM
        if (!this.initialized) { //initializing on first attach
            this.svg.style.width = "100%"
            this.svg.style.height = "100%"
            this.svg.style.position = "absolute"
            this.svg.style.pointerEvents = "none"
            this.svg.style.overflow = "visible"
            this.svg.style.zIndex = "2"
            this.frame.style.width = "100%"
            this.frame.style.height = "100%"
            this.frame.map = this
            this.surface.style.width = "10000px" //setting this too narrow creates visual glitches, 
            this.surface.style.height = "1px"
            this.shadow.appendChild(this.frame)
            this.frame.appendChild(this.surface)
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
            this.initialized = true
        }
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
        let rect = node.getBoundingClientRect()
        for (var key in this.nodes) {
            let val = this.nodes[key]
            let rect1 = val.getBoundingClientRect()
            if (overlap(rect,rect1) && val != node) containers.push(val)
        }
        return containers
    }
}

export class GenericNode extends HTMLElement {
    constructor(config) {
        super();
        if (config) this.config = config 
        else this.config = {}
        if (this.config.uuid) this.uuid = this.config.uuid
        else this.uuid = Math.random().toString(36).substring(2) //generate unique identifier
        this.incoming = {} //initialize table of incoming edges
        this.outgoing = {} //initialize table of outgoing edges
        this.bg = document.createElement("div"); //initialize background div
        this.initialized = false
        this.bg.mapNode = this
        this.resizeObserver = new ResizeObserver(_ => this.repel())
        this.resizeObserver.observe(this)
        this.initDrag(1)
        $(this).on("dragstop", _ => { this.map.changed() })
    }

    initAttach (parent,x,y) {
        this.map = parent
        this.map.nodes[this.uuid] = this //register in the map
        this.left = x
        this.top = y
        this.attach(parent)
    }
    
    connectedCallback() {
        if (!this.initialized) {
            this.style.position = 'absolute'
            this.style.display= 'inline-block'
            this.style.border = '1px solid gray'
            this.style.padding = '10px'
            this.bg.style.display = 'inline-block'
            this.bg.style.position = 'absolute'
            this.bg.style.background = 'white'
            this.bg.style.top = 0
            this.bg.style.left = 0
            this.bg.style.height = '100%'
            this.bg.style.width = '100%'
            this.appendChild(this.bg)
            this.initialized = true
        }
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

    repel(filter) {
        if (!filter) filter = _ => {return true}
        let rect = this.getBoundingClientRect()
        for (var key in this.map.nodes) {
            let val = this.map.nodes[key]
            let rect1 = val.getBoundingClientRect()
            if (filter(val) && val != this && overlap(rect,rect1)) {
                if (rect1.x + (rect1.width/2) > rect.x + (rect.width/2)) val.left = val.left + 50
                else val.left = (val.left - 50)
                val.repel()
            }
        }
        this.map.redrawEdges()
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
