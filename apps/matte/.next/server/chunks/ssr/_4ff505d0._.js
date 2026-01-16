module.exports=[9270,(a,b,c)=>{"use strict";b.exports=a.r(42602).vendored.contexts.AppRouterContext},38783,(a,b,c)=>{"use strict";b.exports=a.r(42602).vendored["react-ssr"].ReactServerDOMTurbopackClient},46058,(a,b,c)=>{"use strict";function d(a){if("function"!=typeof WeakMap)return null;var b=new WeakMap,c=new WeakMap;return(d=function(a){return a?c:b})(a)}c._=function(a,b){if(!b&&a&&a.__esModule)return a;if(null===a||"object"!=typeof a&&"function"!=typeof a)return{default:a};var c=d(b);if(c&&c.has(a))return c.get(a);var e={__proto__:null},f=Object.defineProperty&&Object.getOwnPropertyDescriptor;for(var g in a)if("default"!==g&&Object.prototype.hasOwnProperty.call(a,g)){var h=f?Object.getOwnPropertyDescriptor(a,g):null;h&&(h.get||h.set)?Object.defineProperty(e,g,h):e[g]=a[g]}return e.default=a,c&&c.set(a,e),e}},39118,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0});var d={DEFAULT_SEGMENT_KEY:function(){return l},NOT_FOUND_SEGMENT_KEY:function(){return m},PAGE_SEGMENT_KEY:function(){return k},addSearchParamsIfPageSegment:function(){return i},computeSelectedLayoutSegment:function(){return j},getSegmentValue:function(){return f},getSelectedLayoutSegmentPath:function(){return function a(b,c,d=!0,e=[]){let g;if(d)g=b[1][c];else{let a=b[1];g=a.children??Object.values(a)[0]}if(!g)return e;let h=f(g[0]);return!h||h.startsWith(k)?e:(e.push(h),a(g,c,!1,e))}},isGroupSegment:function(){return g},isParallelRouteSegment:function(){return h}};for(var e in d)Object.defineProperty(c,e,{enumerable:!0,get:d[e]});function f(a){return Array.isArray(a)?a[1]:a}function g(a){return"("===a[0]&&a.endsWith(")")}function h(a){return a.startsWith("@")&&"@children"!==a}function i(a,b){if(a.includes(k)){let a=JSON.stringify(b);return"{}"!==a?k+"?"+a:k}return a}function j(a,b){if(!a||0===a.length)return null;let c="children"===b?a[0]:a[a.length-1];return c===l?null:c}let k="__PAGE__",l="__DEFAULT__",m="/_not-found"},54427,(a,b,c)=>{"use strict";function d(){let a,b,c=new Promise((c,d)=>{a=c,b=d});return{resolve:a,reject:b,promise:c}}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"createPromiseWithResolvers",{enumerable:!0,get:function(){return d}})},60680,a=>{"use strict";var b=a.i(87924),c=a.i(72131);let d=[{name:"Agreeable Gray",hex:"#D1CCC4",accent:"#B8B2A7"},{name:"Repose Gray",hex:"#C8C5BE",accent:"#B0ADA5"},{name:"Worldly Gray",hex:"#D0CCC7",accent:"#B8B3AD"},{name:"Mindful Gray",hex:"#BDB8B0",accent:"#A59F96"},{name:"Sea Salt",hex:"#C5D4C5",accent:"#AEC0AE"},{name:"Alabaster",hex:"#F3EDE5",accent:"#E8DFD3"},{name:"Greek Villa",hex:"#F0EBE0",accent:"#DDD4C5"},{name:"Accessible Beige",hex:"#D4CFC4",accent:"#C4BDB0"},{name:"Drift of Mist",hex:"#E8E3DB",accent:"#D9D2C7"},{name:"Naval",hex:"#1F3A5F",accent:"#2A4D7A"},{name:"Evergreen Fog",hex:"#95978A",accent:"#7D8070"},{name:"Iron Ore",hex:"#434343",accent:"#5A5A5A"},{name:"Urbane Bronze",hex:"#54504A",accent:"#6B665E"},{name:"Hale Navy",hex:"#2D3A4B",accent:"#3D4D63"},{name:"Watery",hex:"#A4D4D4",accent:"#8FC4C4"},{name:"Raindrops",hex:"#B1C4D4",accent:"#9BB0C2"},{name:"Jade Dragon",hex:"#5A7D5A",accent:"#6B9070"},{name:"Sage Green",hex:"#9CAF88",accent:"#8A9D76"},{name:"Peppercorn",hex:"#6C6C6C",accent:"#7D7D7D"},{name:"Colonel Sanders",hex:"#8B6F47",accent:"#9D7F57"},{name:"Copper Penny",hex:"#AD6F69",accent:"#BD7F79"},{name:"Coral Reef",hex:"#D9776B",accent:"#E1877B"}];function e(){let[a,e]=(0,c.useState)(0),[f,g]=(0,c.useState)(!1);(0,c.useEffect)(()=>{let a=setInterval(()=>{g(!0),setTimeout(()=>{e(a=>(a+1)%d.length),g(!1)},1e3)},8e3);return()=>clearInterval(a)},[]);let h=d[a];return(0,c.useEffect)(()=>{let a=document.documentElement;a.style.setProperty("--theme-transition","2s ease-in-out"),a.style.setProperty("--theme-primary",h.hex),a.style.setProperty("--theme-accent",h.accent)},[h]),(0,b.jsxs)(b.Fragment,{children:[(0,b.jsx)("div",{className:"fixed inset-0 pointer-events-none z-0 transition-opacity duration-[2000ms]",style:{background:`linear-gradient(135deg, 
            ${h.hex}08 0%, 
            ${h.hex}15 50%, 
            ${h.accent}12 100%)`,opacity:f?.6:1}}),(0,b.jsx)("div",{className:"fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 pointer-events-none z-10",children:(0,b.jsxs)("div",{className:"flex items-center gap-2 sm:gap-3 bg-white/95 backdrop-blur-sm px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl shadow-lg border border-stone-200 transition-all duration-1000",children:[(0,b.jsx)("div",{className:"relative w-10 h-8 sm:w-16 sm:h-12 rounded-md sm:rounded-lg shadow-md transition-all duration-[2000ms] transform",style:{backgroundColor:h.hex,transform:f?"scale(0.95) rotate(-2deg)":"scale(1) rotate(0deg)"},children:(0,b.jsx)("div",{className:"absolute inset-0 rounded-md sm:rounded-lg bg-gradient-to-br from-white/40 via-transparent to-transparent"})}),(0,b.jsxs)("div",{className:"flex flex-col",children:[(0,b.jsx)("span",{className:"text-[10px] sm:text-xs text-stone-500 font-medium",children:"Sherwin-Williams"}),(0,b.jsx)("span",{className:"text-xs sm:text-sm font-semibold text-stone-800 transition-opacity duration-500",style:{opacity:f?.5:1},children:h.name})]})]})}),(0,b.jsx)("style",{dangerouslySetInnerHTML:{__html:`
        .themed-button {
          background-color: var(--theme-primary) !important;
          transition: background-color var(--theme-transition), transform 0.2s !important;
        }
        
        .themed-button:hover {
          background-color: var(--theme-accent) !important;
          transform: translateY(-1px);
        }

        .themed-badge {
          background-color: var(--theme-primary) !important;
          color: #1c1917 !important;
          transition: background-color var(--theme-transition) !important;
        }

        .themed-accent {
          color: var(--theme-accent) !important;
          transition: color var(--theme-transition) !important;
        }

        .themed-border {
          border-color: var(--theme-primary) !important;
          transition: border-color var(--theme-transition) !important;
        }
      `}})]})}a.s(["PaintChipAnimator",()=>e])}];

//# sourceMappingURL=_4ff505d0._.js.map