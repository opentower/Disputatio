class RelativeLine {
    constructor(s,t,svg) {
        this.svg = svg
        this.source = s
        this.target = t
        this.midpoint= document.createElementNS("http://www.w3.org/2000/svg", 'foreignObject');
        this.path = document.createElementNS("http://www.w3.org/2000/svg", 'path');
        this.head = document.createElementNS("http://www.w3.org/2000/svg", 'path');
        this.label = document.createElement("span")
        this.label.innerHTML = "∙"
        this.path.style.stroke = "#000"; 
        this.path.style.fill = "none"; 
        this.path.style.strokeWidth = "5px";
        this.head.style.stroke = "#000"; 
        this.head.style.fill = "none"; 
        this.head.style.strokeWidth = "5px";
        svg.appendChild(this.path)
        svg.appendChild(this.midpoint)
        svg.appendChild(this.head)
        this.midpoint.appendChild(this.label)
        console.log(this.target)
        this.updatePosition()
    }

    updatePosition () {
        let svgrect = this.svg.getBoundingClientRect()
        let srect = this.source.getBoundingClientRect()
        let trect = this.target.getBoundingClientRect()
        let origin = { x: srect.x - svgrect.x + srect.width/2
                     , y: srect.y - svgrect.y + srect.height}
        let destination = { x: trect.x - svgrect.x + trect.width/2
                          , y: trect.y - svgrect.y - 10}
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
        this.svg.removeChild(this.path)
        this.svg.removeChild(this.midpoint) 
        this.svg.removeChild(this.head) 
    }

    set color (c) { 
        this.path.style.stroke = c; 
        this.head.style.stroke = c; 
    }

    get color () { return this.path.style.stroke }
}

module.exports = RelativeLine;
