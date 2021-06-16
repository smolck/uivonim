{
  'targets': [
    {
      'target_name': 'msdf-atlas',
      'sources': [
        "src/addon.cc",
        "src/Atlas.h",
        "src/FontHolder.h",

        "msdf-atlas-gen/msdfgen/ext/import-font.cpp",
        "msdf-atlas-gen/msdfgen/ext/save-png.cpp",
        "msdf-atlas-gen/msdfgen/lib/lodepng.cpp",
        "msdf-atlas-gen/msdfgen/core/msdfgen.cpp",
        "msdf-atlas-gen/msdfgen/core/EdgeHolder.cpp",
        "msdf-atlas-gen/msdfgen/core/contour-combiners.cpp",
        "msdf-atlas-gen/msdfgen/core/Contour.cpp",
        "msdf-atlas-gen/msdfgen/core/edge-coloring.cpp",
        "msdf-atlas-gen/msdfgen/core/edge-segments.cpp",
        "msdf-atlas-gen/msdfgen/core/edge-selectors.cpp",
        "msdf-atlas-gen/msdfgen/core/equation-solver.cpp",
        "msdf-atlas-gen/msdfgen/core/Shape.cpp",
        "msdf-atlas-gen/msdfgen/core/Vector2.cpp",
        "msdf-atlas-gen/msdfgen/core/SignedDistance.cpp",
        "msdf-atlas-gen/msdfgen/core/MSDFErrorCorrection.cpp",
        "msdf-atlas-gen/msdfgen/core/msdf-error-correction.cpp",
        "msdf-atlas-gen/msdfgen/core/Projection.cpp",
        "msdf-atlas-gen/msdfgen/core/rasterization.cpp",
        "msdf-atlas-gen/msdfgen/core/Scanline.cpp",
        "msdf-atlas-gen/msdfgen/core/save-bmp.cpp",
        # msdf-atlas-gen sources
        "msdf-atlas-gen/msdf-atlas-gen/FontGeometry.cpp",
        "msdf-atlas-gen/msdf-atlas-gen/GlyphGeometry.cpp",
        "msdf-atlas-gen/msdf-atlas-gen/TightAtlasPacker.cpp",
        "msdf-atlas-gen/msdf-atlas-gen/RectanglePacker.cpp",
        "msdf-atlas-gen/msdf-atlas-gen/size-selectors.cpp",
        "msdf-atlas-gen/msdf-atlas-gen/bitmap-blit.cpp",
        "msdf-atlas-gen/msdf-atlas-gen/glyph-generators.cpp",
        "msdf-atlas-gen/msdf-atlas-gen/Workload.cpp",
        "msdf-atlas-gen/msdf-atlas-gen/json-export.cpp",
        # "msdf-atlas-gen/third_party/fmt/src/fmt.cc",
        "msdf-atlas-gen/third_party/fmt/src/format.cc",
        "msdf-atlas-gen/third_party/fmt/src/os.cc"
      ],
      "xcode_settings": {
        "GCC_ENABLE_CPP_RTTI": "YES",
        "CLANG_CXX_LANGUAGE_STANDARD":"c++14",
      },
      "include_dirs": [
        "<!(node -e \"require('nan')\")",
        "msdf-atlas-gen/msdfgen/",
        "msdf-atlas-gen/msdf-atlas-gen",
        "msdf-atlas-gen/msdfgen/include",
        "msdf-atlas-gen/msdfgen/freetype/include",
        "msdf-atlas-gen/msdfgen/core",
        "msdf-atlas-gen/msdfgen/ext",
        "msdf-atlas-gen/third_party/fmt/include/"
      ],
      # TODO(smolck): Linux & Windows
      "conditions": [
        [
            "OS=='mac'",
            {
                "defines": [
                    "__MACOSX_CORE__"
                ],
                "architecture": "i386",
                "xcode_settings": {
                    "GCC_ENABLE_CPP_EXCEPTIONS": "YES"
                },
                "link_settings": {
                    "libraries": [
                        "-lfreetype",
                    ],
                    "configurations": {
                        "Debug": {
                            "xcode_settings": {
                                "OTHER_LDFLAGS": [
                                    "-L/opt/homebrew/lib/"
                                ]
                            }
                        },
                        "Release": {
                            "xcode_settings": {
                                "OTHER_LDFLAGS": [
                                    "-L/opt/homebrew/lib/"
                                ]
                            }
                        }
                    }
                }
            }
        ],
      ]
    }
  ]
}
