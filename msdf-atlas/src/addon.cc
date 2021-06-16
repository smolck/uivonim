#define LCG_MULTIPLIER 6364136223846793005ull
#define DEFAULT_ANGLE_THRESHOLD 3.0
#include <iostream>
#include <msdf-atlas-gen.h>
#include "Atlas.h"
#include "FontHolder.h"
#include <nan.h>

using Nan::GetFunction;
using Nan::New;
using Nan::Set;
using v8::FunctionTemplate;
// using v8::Handle;
using v8::Object;
using v8::String;

using msdf_atlas::BitmapAtlasStorage;
using msdf_atlas::byte;
using msdf_atlas::FontGeometry;
using msdf_atlas::GlyphGeometry;
using msdf_atlas::ImmediateAtlasGenerator;

static msdfgen::BitmapConstRef<float, 3>
makeAtlas(const std::vector<GlyphGeometry> &glyphs,
          const std::vector<FontGeometry> &fonts, int width, int height) {
  ImmediateAtlasGenerator<float, 3, msdf_atlas::msdfGenerator,
                          BitmapAtlasStorage<float, 3>>
      generator(width, height);
  generator.setThreadCount(1);
  generator.generate(glyphs.data(), glyphs.size());
  auto bitmap = (msdfgen::BitmapConstRef<float, 3>)generator.atlasStorage();

  // bool success = true;

  if (msdf_atlas::saveImage(bitmap, msdf_atlas::ImageFormat::PNG,
                            "whatever.png", msdf_atlas::YDirection::BOTTOM_UP))
    puts("Atlas image file saved.");
  else {
    puts("Failed to save the atlas as an image file.");
  }

  return bitmap;
}

NAN_METHOD(stuff) {
  // Load fonts
  std::vector<GlyphGeometry> glyphs;
  std::vector<FontGeometry> fonts;
  bool anyCodepointsAvailable = false;
  FontHolder font;

  if (!font.load("Inconsolata-Regular.ttf")) {
    std::cout << "sadness!" << std::endl;
  };

  // Load character set
  std::set<msdf_atlas::unicode_t> charset;
  charset.insert('b');
  charset.insert('m');
  charset.insert('x');
  charset.insert('p');
  charset.insert('1');
  charset.insert('2');
  charset.insert('3');

  // Load glyphs
  FontGeometry fontGeometry(&glyphs);
  int charsLoaded = fontGeometry.loadCharset(font, 1, charset, true, true);
  if (charsLoaded < 0)
    std::cout << "Glyphs not loaded, sadness!" << std::endl;
  printf("Loaded geometry of %d out of %d glyphs", charsLoaded,
         (int)charset.size());

  fonts.push_back((FontGeometry &&) fontGeometry);
  std::cout << "empty? " << glyphs.empty() << std::endl;

  int width;
  int height;
  {
    double unitRange = 0, pxRange = 0;
    // bool fixedDimensions = 32 >= 0 && 32 >= 0;
    // bool fixedScale = true;
    msdf_atlas::TightAtlasPacker atlasPacker;
    // if (fixedDimensions)
    atlasPacker.setDimensionsConstraint(
        msdf_atlas::TightAtlasPacker::DimensionsConstraint::
            MULTIPLE_OF_FOUR_SQUARE);
    // else
    // atlasPacker.setDimensionsConstraint(atlasSizeConstraint);
    /*atlasPacker.setPadding(config.imageType == ImageType::MSDF ||
                                   config.imageType == ImageType::MTSDF
                               ? 0
                               : -1);*/
    // TODO: In this case (if padding is -1), the border pixels of each glyph
    // are black, but still computed. For floating-point output, this may play a
    // role.
    /*if (fixedScale)
      atlasPacker.setScale(config.emSize);
    else
      atlasPacker.setMinimumScale(minEmSize);*/
    // atlasPacker.setPadding(-1);
    atlasPacker.setScale(32);
    atlasPacker.setPadding(0);
    atlasPacker.setPixelRange(2);
    // atlasPacker.setUnitRange();
    atlasPacker.setMiterLimit(1);
    if (int remaining = atlasPacker.pack(glyphs.data(), glyphs.size())) {
      if (remaining < 0) {
        printf("Failed to pack glyphs into atlas.");
      } else {
        printf("Error: Could not fit %d out of %d glyphs into the atlas.\n",
               remaining, (int)glyphs.size());
      }
    }
    atlasPacker.getDimensions(width, height);
    /*atlasPacker.getDimensions(32, 32);
    if (!(config.width > 0 && config.height > 0))
      printf("Unable to determine atlas size.");
    config.emSize = atlasPacker.getScale();
    config.pxRange = atlasPacker.getPixelRange();
    if (!fixedScale)
      printf("Glyph size: %.9g pixels/EM\n", config.emSize);
    if (!fixedDimensions)
      printf("Atlas dimensions: %d x %d\n", config.width, config.height);*/
  }

  // Edge coloring
  if (false) {
    /*msdf_atlas::Workload(
        [&glyphs, &config](int i, int threadNo) -> bool {
          unsigned long long glyphSeed =
              (LCG_MULTIPLIER * (config.coloringSeed ^ i) + LCG_INCREMENT) *
              !!config.coloringSeed;
          glyphs[i].edgeColoring(config.edgeColoring, config.angleThreshold,
                                 glyphSeed);
          return true;
        },
        glyphs.size())
        .finish(config.threadCount);*/
  } else {
    unsigned long long glyphSeed = 0;
    for (GlyphGeometry &glyph : glyphs) {
      glyphSeed *= LCG_MULTIPLIER;
      glyph.edgeColoring(msdfgen::edgeColoringInkTrap, DEFAULT_ANGLE_THRESHOLD,
                         glyphSeed);
    }
  }

  auto bitmap = makeAtlas(glyphs, fonts, width, height);
  std::cout << bitmap.width << " " << bitmap.height << std::endl;
  auto *pixels = new std::vector<byte>(3 * bitmap.width * bitmap.height);

  std::vector<byte>::iterator it = pixels->begin();
  using msdfgen::pixelFloatToByte;
  for (int y = bitmap.height - 1; y >= 0; --y)
    for (int x = 0; x < bitmap.width; ++x) {
      std::cout << x << " , " << y << std::endl;
      *it++ = pixelFloatToByte(bitmap(x, y)[0]);
      *it++ = pixelFloatToByte(bitmap(x, y)[1]);
      *it++ = pixelFloatToByte(bitmap(x, y)[2]);
    }

  std::cout << pixels->size() << "size" << std::endl;

  info.GetReturnValue().Set(
      Nan::NewBuffer((char *)pixels->data(), pixels->size(),
                     [](char *data, void *vec) {
                       delete reinterpret_cast<std::vector<byte> *>(vec);
                     },
                     pixels)
          .ToLocalChecked());
}

NAN_MODULE_INIT(InitAll) {
  Set(target, New<String>("stuff").ToLocalChecked(),
      GetFunction(New<FunctionTemplate>(stuff)).ToLocalChecked());

  Atlas::Init(target);
}

NODE_MODULE(msdf_atlas, InitAll)
