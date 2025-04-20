(let [fib (fn f [x]
            (if (__eq x 0) 1
              (if (__eq x 1) 1
                (__plus (f (__minus x 1)) (f (__minus x 2))))))]
  (__print (fib 40)))