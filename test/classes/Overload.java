import java.lang.reflect.Constructor;

public class Overload {

  private String text;

  public Overload() {
    System.out.println("Overload()");
    this.text = "empty";
  }

  public Overload(Character c) {
    this.text = "Character:" + c;
  }

  public Overload(Long l) {
    this.text = "Long:" + l;
  }

  public Overload(Float f) {
    this.text = "Float:" + f;
  }

  public static String staticMethod(char ch) {
    return "char:" + ch;
  }

  public static String staticMethod(byte b) {
    return "byte:" + b;
  }

  public static String staticMethod(Float f) {
    return "Float:" + f;
  }

  public String method(String name) {
    return "String:" + name;
  }

  public String method(Byte b) {
    return "Byte:" + b;
  }

  public String method(Short b) {
    return "Short:" + b;
  }

  public String getText() {
    return text;
  }
}