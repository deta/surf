<script lang="ts">
  /**
   *  Emulating risography / CMYK printing with animatable and adjustable parameters.
   *  https://www.liznugentdraws.com/blog/3221
   *  https://ameye.dev/notes/halftone-shader/
   *  https://leanrada.com/notes/pure-css-halftone/
   *  https://www.visualcinnamon.com/2016/05/beautiful-color-blending-svg-d3/
   *
   */
  import { Tween } from 'svelte/motion'
  import { RisoTextController } from './risoTextController.svelte.ts'

  let {
    text = '',

    incBleed = 0,
    textBleed = 0,
    rasterDensity = 3,
    rasterFill = 0.35,

    animationController,

    ...restProps
  }: {
    text: string

    // 0-1 How much to emulate the "inc color bleed" effect
    incBleed: number
    textBleed: number

    // How dense the raster dots are spaced
    rasterDensity: number

    // 0-1 How much the raster dots will the space from not at all to overfill
    rasterFill: number

    // Animate the raster effects
    animationController?: RisoTextController
  } = $props()

  const id = crypto.randomUUID()

  const t_rasterDensity = animationController
    ? animationController.t_rasterDensity
    : new Tween(rasterDensity, { duration: 0 })

  $effect(() => {
    t_rasterDensity.target = rasterDensity
  })

  const t_rasterFill = animationController
    ? animationController.t_rasterFill
    : new Tween(rasterFill, { duration: 0 })
  $effect(() => {
    t_rasterFill.target = rasterFill
  })

  const t_textBleed = animationController
    ? animationController.t_textBleed
    : new Tween(textBleed, { duration: 0 })
  $effect(() => {
    t_textBleed.target = textBleed
  })

  const COLOR_PALETTES: Record<string, { k: string; c: string; m: string; y: string }> = {
    DEFAULT_CMYK: {
      k: 'var(--riso-k)',
      c: 'var(--riso-c)',
      m: 'var(--riso-m)',
      y: 'var(--riso-y)'
    }
  }
  const colorPalette = COLOR_PALETTES.DEFAULT_CMYK

  const ANGLES: Record<string, { black: number; yellow: number; cyan: number; magenta: number }> = {
    A: {
      yellow: 0,
      cyan: 15,
      magenta: 75,
      black: 45
    },
    B: {
      yellow: 90,
      cyan: 105,
      magenta: 75,
      black: 15
    },
    C: {
      yellow: 0,
      cyan: 15,
      magenta: 45,
      black: 75
    },
    D: {
      yellow: 90,
      cyan: 165,
      magenta: 45,
      black: 105
    }
  }
  const SELECTED_ANGLE_TYPE = ANGLES.A
  const SELECTED_ANGLES = $derived({
    black: SELECTED_ANGLE_TYPE.black + 0,
    yellow: SELECTED_ANGLE_TYPE.yellow + 0,
    cyan: SELECTED_ANGLE_TYPE.cyan + 0,
    magenta: SELECTED_ANGLE_TYPE.magenta - 0
  })
</script>

<svg class="riso" width="100%" height="100%" preserveAspectRatio="xMinYMid meet" {...restProps}>
  <defs>
    <!-- We use this text mask as a final "cutout" for the target text we display -->
    <filter id="{id}_textBlur">
      <feGaussianBlur stdDeviation={t_textBleed.current} />
    </filter>
    <mask id="{id}_textMask" x="0" y="0" width="100%" height="100%">
      <text
        x="0"
        y="50%"
        text-anchor="start"
        dominant-baseline="middle"
        font-size="1em"
        font-weight="300"
        letter-spacing="0.022rem"
        fill="white"
        filter="url(#{id}_textBlur)"
      >
        {text}
      </text>
    </mask>

    <!-- Generates single dots with optional gradient emulating ink bleed -->
    <radialGradient id="{id}_K_dot" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color={colorPalette.k} stop-opacity="1" />
      <stop offset="100%" stop-color={colorPalette.k} stop-opacity={1 - incBleed} />
    </radialGradient>
    <radialGradient id="{id}_Y_dot" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color={colorPalette.y} stop-opacity="1" />
      <stop offset="100%" stop-color={colorPalette.y} stop-opacity={1 - incBleed} />
    </radialGradient>
    <radialGradient id="{id}_C_dot" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color={colorPalette.c} stop-opacity="1" />
      <stop offset="100%" stop-color={colorPalette.c} stop-opacity={1 - incBleed} />
    </radialGradient>
    <radialGradient id="{id}_M_dot" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color={colorPalette.m} stop-opacity="1" />
      <stop offset="100%" stop-color={colorPalette.m} stop-opacity={1 - incBleed} />
    </radialGradient>

    <!-- Create dot pattern for each CMYK color channel -->
    <pattern
      id="{id}_K_dots"
      patternUnits="userSpaceOnUse"
      width={t_rasterDensity.current}
      height={t_rasterDensity.current}
    >
      <circle
        cx={t_rasterDensity.current / 2}
        cy={t_rasterDensity.current / 2}
        r={t_rasterDensity.current * t_rasterFill.current}
        fill="url(#{id}_K_dot)"
      />
    </pattern>
    <pattern
      id="{id}_Y_dots"
      patternUnits="userSpaceOnUse"
      width={t_rasterDensity.current}
      height={t_rasterDensity.current}
    >
      <circle
        cx={t_rasterDensity.current / 2}
        cy={t_rasterDensity.current / 2}
        r={t_rasterDensity.current * t_rasterFill.current}
        fill="url(#{id}_Y_dot)"
      />
    </pattern>
    <pattern
      id="{id}_C_dots"
      patternUnits="userSpaceOnUse"
      width={t_rasterDensity.current}
      height={t_rasterDensity.current}
    >
      <circle
        cx={t_rasterDensity.current / 2}
        cy={t_rasterDensity.current / 2}
        r={t_rasterDensity.current * t_rasterFill.current}
        fill="url(#{id}_C_dot)"
      />
    </pattern>
    <pattern
      id="{id}_M_dots"
      patternUnits="userSpaceOnUse"
      width={t_rasterDensity.current}
      height={t_rasterDensity.current}
    >
      <circle
        cx={t_rasterDensity.current / 2}
        cy={t_rasterDensity.current / 2}
        r={t_rasterDensity.current * t_rasterFill.current}
        fill="url(#{id}_M_dot)"
      />
    </pattern>

    <filter id="multiply-blend" x="0" y="0" width="1" height="1">
      <feBlend mode="multiply" in="SourceGraphic" in2="BackgroundImage" />
    </filter>
  </defs>

  <!--  Actually "composite" the dot patterns and blend them correctly
        Here we also mask with the text to only display the actual text with the effect.
  -->
  <g mask="url(#{id}_textMask)">
    <g transform="translate(-500,-500)">
      <rect
        class="yellow"
        transform-origin="center"
        transform="rotate({SELECTED_ANGLES.yellow})"
        x="50%"
        y="50%"
        width="1000"
        height="1000"
        fill="url(#{id}_Y_dots)"
        filter="url(#multiply-blend)"
      />
    </g>

    <g transform="translate(-500,-500)">
      <rect
        class="cyan"
        transform-origin="center"
        transform="rotate({SELECTED_ANGLES.cyan})"
        x="50%"
        y="50%"
        width="1000"
        height="1000"
        fill="url(#{id}_C_dots)"
        filter="url(#multiply-blend)"
      />
    </g>

    <g transform="translate(-500,-500)">
      <rect
        class="magenta"
        transform-origin="center"
        transform="rotate({SELECTED_ANGLES.magenta})"
        x="50%"
        y="50%"
        width="1000"
        height="1000"
        fill="url(#{id}_M_dots)"
        filter="url(#multiply-blend)"
      />
    </g>

    <g transform="translate(-500,-500)">
      <rect
        class="black"
        transform-origin="center"
        transform="rotate({SELECTED_ANGLES.black})"
        x="50%"
        y="50%"
        width="1000"
        height="1000"
        fill="url(#{id}_K_dots)"
        filter="url(#multiply-blend)"
      />
    </g>
  </g>
</svg>

<style lang="scss">
  svg.riso {
    font-size: 1em;

    --riso-k: light-dark(#000000, #ffffff);
    --riso-c: light-dark(#00ffff, rgb(100, 255, 218));
    --riso-m: light-dark(#ff00ff, rgb(255, 110, 199));
    --riso-y: light-dark(#ffff00, rgb(255, 230, 109));

    rect {
      transform-box: fill-box;
      transform-origin: center;
    }
  }
</style>
