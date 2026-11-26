import * as T from 'three';

// A rosette of arching ribbons. The tip turns away from the base, giving each
// blade a different silhouette when viewed along or across the wind.
export function createBlades(random) {
  const positions = [], colors = [], flex = [], indices = [];
  const palette = ['#789755', '#a6ba70', '#9eae59', '#86a261', '#b1bb76'].map(c => new T.Color(c));
  for (let blade = 0; blade < 21; blade++) {
    const angle = blade * 2.4 + random() * .7;
    const radius = .025 + random() * .20;
    const x = radius * Math.cos(angle), z = radius * Math.sin(angle);
    const basal = blade % 3 === 0;
    const height = basal ? .18 + .15 * random() : .35 + .34 * random();
    const width = basal ? .037 : .019 + .015 * random();
    const sweep = height * (.26 + random() * .45), twist = (random() - .5) * 1.5;
    const base = flex.length, color = palette[blade % palette.length];
    for (const [q, half, shade] of [[0,.52,.53],[.34,1,.77],[.72,.53,.99],[1,0,1.12]]) {
      const heading = angle + twist * q;
      const cx = x + sweep * q * q * Math.cos(heading), cz = z + sweep * q * q * Math.sin(heading);
      const y = height * (q - .19 * q * q * q);
      for (const side of (q === 1 ? [0] : [-1,1])) {
        positions.push(cx - Math.sin(heading) * width * half * side, y + side * half * .009, cz + Math.cos(heading) * width * half * side);
        const light = shade * (1 + side * .065);
        colors.push(color.r * light, color.g * light, color.b * light);
        flex.push(height * q * q);
      }
    }
    for (const i of [0,2]) indices.push(base+i,base+i+1,base+i+2,base+i+1,base+i+3,base+i+2);
    indices.push(base+4,base+5,base+6);
  }
  return meadowGeometry(positions, colors, flex, indices);
}

// Thin stems and alternating oat spikelets share one instanced draw per patch.
export function createSeedHeads() {
  const positions = [], colors = [], flex = [], indices = [];
  const stalk = new T.Color('#8e9e55'), husk = new T.Color('#c3b878');
  const vertex = (x,y,z,color,shade) => {
    positions.push(x,y,z);
    colors.push(color.r*shade,color.g*shade,color.b*shade);
    flex.push(y*y/.86);
  };
  for (let stem=0;stem<3;stem++) {
    const angle=stem*2.42,dx=Math.cos(angle),dz=Math.sin(angle);
    const base=flex.length,h=.68+.09*stem;
    for (const q of [0,.55,1]) {
      const x=dx*(.10+.18*q*q),z=dz*(.10+.18*q*q);
      for(const side of [-1,1])vertex(x-side*dz*.006,h*q,z+side*dx*.006,stalk,.67+q*.34);
    }
    indices.push(base,base+1,base+2,base+1,base+3,base+2,base+2,base+3,base+4,base+3,base+5,base+4);
    for (let j=0;j<6;j++) {
      const q=.70+j*.05,sign=j%2?1:-1,n=flex.length;
      const x=dx*(.10+.18*q*q),z=dz*(.10+.18*q*q),len=.065-j*.004;
      vertex(x,h*q,z,husk,.84);
      vertex(x+dx*.013-dz*sign*len*.5,h*q+.035,z+dz*.013+dx*sign*len*.5,husk,1.05);
      vertex(x-dx*.013-dz*sign*len*.5,h*q+.039,z-dz*.013+dx*sign*len*.5,husk,.93);
      vertex(x-dz*sign*len,h*q+.071,z+dx*sign*len,husk,1.13);
      indices.push(n,n+1,n+2,n+1,n+3,n+2);
    }
  }
  return meadowGeometry(positions,colors,flex,indices);
}

function meadowGeometry(positions, colors, flex, indices) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(positions,3));
  g.setAttribute('color', new T.Float32BufferAttribute(colors,3));
  g.setAttribute('flex', new T.Float32BufferAttribute(flex,1));
  // A tilted canopy normal keeps the unlit backs of fine two-sided leaves legible.
  const normals = new Float32Array(positions.length);
  for (let i=0;i<flex.length;i++) {
    const tilt = .22 * flex[i];
    normals.set([tilt,Math.sqrt(1-tilt*tilt),0],i*3);
  }
  g.setAttribute('normal',new T.BufferAttribute(normals,3));g.setIndex(indices);
  return g;
}
