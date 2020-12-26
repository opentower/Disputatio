var $ = require("jquery")

class RelativeLine {
    constructor(s,t,map) {
        this.map = map
        this.source = s
        this.target = t
        this.midpoint= document.createElementNS("http://www.w3.org/2000/svg", 'foreignObject');
        this.path = document.createElementNS("http://www.w3.org/2000/svg", 'path');
        this.head = document.createElementNS("http://www.w3.org/2000/svg", 'path');
        this.label = document.createElementNS("http://www.w3.org/1999/xhtml","span")
        this.path.classList.add("argumentPath")
        this.head.classList.add("argumentHead")
        this.midpoint.classList.add("argumentDeco")
        this.map.svg.appendChild(this.path)
        this.map.svg.appendChild(this.midpoint)
        this.map.svg.appendChild(this.head)
        this.midpoint.appendChild(this.label)
        this.updatePosition()
    }

    updatePosition () {
        let svgrect = this.map.svg.getBoundingClientRect()
        let srect = this.source.getBoundingClientRect()
        let trect = this.target.getBoundingClientRect()
        let zoom
        if (this.map.transform) { zoom = this.map.transform.scale } else { zoom = 1 }
        let origin = { x: (srect.x - svgrect.x + srect.width/2)/zoom
                     , y: (srect.y - svgrect.y + srect.height)/zoom - 1}
        let destination = { x: (trect.x - svgrect.x + trect.width/2)/zoom
                          , y: (trect.y - svgrect.y)/zoom - 10}
        this.path.setAttribute("d", "M" + origin.x + "," + origin.y 
                                        + " C" + origin.x + "," + (origin.y + 90) 
                                        + " " + destination.x + "," + (destination.y - 90) 
                                        + " " + destination.x + "," + destination.y)
        this.head.setAttribute("d", "M" + (destination.x - 10) + "," + (destination.y - 10)
                                        + " L" + (destination.x) + "," + (destination.y)
                                        + " L" + (destination.x + 10) + "," + (destination.y - 10))
        this.midpoint.setAttribute("x", (origin.x + destination.x)/2)
        this.midpoint.setAttribute("y", (origin.y + destination.y)/2)
    }

    remove() { 
        this.map.svg.removeChild(this.path)
        this.map.svg.removeChild(this.midpoint) 
        this.map.svg.removeChild(this.head) 
    }

    get valence () { 
        return this.path.dataset.valence 
    }

    set valence (c) { 
        this.path.dataset.valence = c; 
        this.head.dataset.valence = c; 
    }

}

module.exports = RelativeLine;
