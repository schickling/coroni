import { renderGraph, Node, Edge, renderLocalGroup } from '../src/rendering'


function createNodes(count: number) {
  const nodes: Node[] = []

  for(let i = 0; i < count; i++) {
    nodes.push({
      id: `${i}`,
      risk: Math.random()
    })
  }

  return nodes
}

function createEdges(count: number, nodes: Node[]) {
  const edges: Edge[] = []

  for(let i = 0; i < count; i++) {

    const from = Math.floor(Math.random() * nodes.length)
    const to = Math.floor(Math.random() * nodes.length)

    if(from === to) {
      continue
    }

    edges.push({
      from: nodes[from],
      to: nodes[to],
      count: Math.floor(Math.sqrt(Math.random() * 25) + 1)
    })
  }

  return edges
}

describe('Rendering "tests".', () => {
  test('Should render full', async () => {

    const nodes: Node[] = createNodes(100)
    const edges: Edge[] = createEdges(100, nodes)

    await renderGraph(nodes, edges, 'test.png')
  }, 60000)

  test('Should render local', async () => {

    // Denser mesh
    const nodes: Node[] = createNodes(10)
    const edges: Edge[] = createEdges(25, nodes)

    await renderGraph(nodes, edges, 'test_local_verify.png')
    await renderLocalGroup(nodes, edges, `${nodes[0].id}`, 'test_local.png')
  }, 60000)
})