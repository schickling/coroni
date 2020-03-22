// @ts-ignore
import cytosnap from 'cytosnap'
// @ts-ignore
import * as cytoscape from 'cytoscape'
import _ from 'lodash'
import { writeFileSync, writeFile, createWriteStream, ReadStream, readFileSync } from 'fs';

cytosnap.use([ 'cytoscape-fcose', 'cytoscape-euler'  ]);

const toHex = (a: number) => {
  let hex = Number(Math.floor(a)).toString(16);
  if (hex.length < 2) {
    hex = "0" + hex;
  }
  return hex;
};

const colorHex = (r: number, g: number, b: number) => {
  var red = toHex(r);
  var green = toHex(g);
  var blue = toHex(b);
  return `#${red}${green}${blue}`;
};

const log = function<T>(a: T) {
  console.log(a)
  return a
} 

const images = _.shuffle(
  readFileSync(__dirname + '/images.txt', 'utf-8').split('\n').filter(x => x.length > 0)
)

const genImage = (r: Node) => {
  if(r.id.startsWith('spec')) {
    // A 1x1 pixel, white.
    return 'data:image/gif;base64,R0lGODlhAQABAIAAAP7//wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw=='
  }
  return images[parseInt(r.id) % images.length]
} 

const colors = [
  '#742A2A',
  '#C53030',
  '#E53E3E',
  '#FB5C5C',
  '#EA7B58',
  '#ED8936',
  '#F6AD55',
  '#ECC94B',
  '#F6E05E',
  '#D2DB6C',
  '#B1D368',
  '#60CF78',
  '#3FC183'
]

const riskColor = (r: Node) => {
  if(r.id.startsWith('spec')) {
    return 'white'
  }

  return colors[Math.floor((1 - r.risk) * (colors.length - 1))]
}

export interface Node {
  id: string,
  risk: number
}

export interface Edge {
  from: Node
  to: Node
  count: number
}

const toCytoData = (nodes: Node[], edges: Edge[]) => {
  const elements: any = []
 
  for(const node of nodes) {
    elements.push({
      data: {
        id: node.id,
        bgcolor: riskColor(node),
        image: genImage(node)
      }
    })
  }

  for(const edge of edges) {
    elements.push({
      data: {
        source: edge.from.id,
        target: edge.to.id,
        sourcecolor: riskColor(edge.from),
        destcolor: riskColor(edge.to),
        width: edge.count + 'px'
      }
    })
  }

  return elements
}

const createStyleSheet = function() {
  return cytoscape.stylesheet()
  .selector('node')
    .style({
      'background-fit': 'cover',
      'border-color': (elem: any) => elem.data('bgcolor'),
      'background-color': (elem: any) => elem.data('bgcolor'),
      'border-width': 5,
      'background-image': (elem: any) => elem.data('image')
    })
  .selector('edge')
    .style({
      'width': (elem: any) => elem.data('width'),
      'line-fill': 'linear-gradient',
      'line-gradient-stop-colors': (elem: any) => elem.data('sourcecolor') + ' ' + elem.data('destcolor'),
      'line-gradient-stop-positions': '0% 100%'
    })
}

async function saveImage(image: ReadStream, path: string) {
  const stream = createWriteStream(path)
  image.pipe(stream)

  await new Promise((resolve, reject) => stream.on('finish', resolve))

  stream.close()
}

export async function renderGraph(nodes: Node[], edges: Edge[], path: string) {

  const snap = cytosnap();

  await snap.start()

  // http://js.cytoscape.org/#notation/elements-json
 
  const image: ReadStream = await snap.shot({
    elements: toCytoData(nodes, edges),
    layout: { // http://js.cytoscape.org/#init-opts/layout
      name: 'fcose' // you may reference a `cytoscape.use()`d extension name here
    },
    // Don't call, pass function!
    style: createStyleSheet,
    resolvesTo: 'stream',
    format: 'png',
    width: 1024,
    height: 768,
    background: 'transparent'
  });

  await saveImage(image, path)

  await snap.stop()
}
export async function renderLocalGroup(allNodes: Node[], allEdges: Edge[], aroundId: string, path: string) {

  const snap = cytosnap();

  const node0 = allNodes.filter(x => x.id === aroundId)[0]
  node0.risk = 0

  // Calc 1st neighbors
  const edges1 = allEdges.filter(x => x.to.id === aroundId || x.from.id === aroundId)
    .map(e => {
      // Turn edges the right way (Dag mode)
      const other = node0.id === e.from.id ? e.to : e.from

      return {
        from: node0,
        to: other,
        count: e.count
      }
    })
  const nodes1 = _.uniqBy(edges1.flatMap(x => [x.to]), x => x.id)
 
  // 2nd neighbors are just pseudo-edges
  const edges2: Edge[] = []
  const nodes2: Node[] = []

  for(const n of nodes1) {
    let c = 0
    for(const e of allEdges) {
      if(e.from.id === n.id || e.to.id === n.id) {

        const other = n.id === e.from.id ? e.to : e.from

        // Don't include initial
        if(other.id === aroundId) {
          continue
        }

        const newN: Node = {
          id: `spec_${other.id}_${n.id}`,
          risk: 1 // other.risk
        }

        nodes2.push(newN)

        edges2.push({
          from: n,
          to: newN,
          count: e.count
        })
        c = c + 1
      }
    }
  }


  const nodes = _.uniqBy([node0, ...nodes1, ...nodes2], x => x.id)
  const edges = [...edges1, ...edges2]

  await snap.start()
 
  const image: ReadStream = await snap.shot({
    elements: toCytoData(nodes, edges),
    layout: {
      name: 'fcose',
      padding: 0
    },
    // Don't call, pass function!
    style: createStyleSheet,
    resolvesTo: 'stream',
    format: 'png',
    width: 1024,
    height: 1024,
    background: 'transparent',
  });

  await saveImage(image, path)

  await snap.stop()
}