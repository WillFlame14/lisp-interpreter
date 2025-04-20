(let [x 2
      f (fn mh [y] (__plus x y))]
  (__print (f 3)))